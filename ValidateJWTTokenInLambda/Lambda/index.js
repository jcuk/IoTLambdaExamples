var https = require('https');
var jose = require('node-jose');

var region = 'eu-west-2';
var userpool_id = 'eu-west-2_6Qk8UHkl5';
var app_client_id = '41pboo7igtsbm6bfi18sje5p96';
var keys_url = 'https://cognito-idp.' + region + '.amazonaws.com/' + userpool_id + '/.well-known/jwks.json';

exports.handler = (event, context, callback) => {
    var token = event.token;
    try {
        validateToken(token, function(result) {
            callback(null, 'JWT Claims are valid');    
        });

    } catch (e) {
        callback(e);
    }
};

var validateToken = (token, callback) => {
	if (token === undefined) {
		throw new Error('Now JWTToken in request');
	};
	
    var sections = token.split('.');
    // get the kid from the headers prior to verification
    var header = jose.util.base64url.decode(sections[0]);
    header = JSON.parse(header);
    var kid = header.kid;
    // download the public keys
    https.get(keys_url, function(response) {
        if (response.statusCode == 200) {
            response.on('data', function(body) {
                var keys = JSON.parse(body)['keys'];
                // search for the kid in the downloaded public keys
                var key_index = -1;
                for (var i=0; i < keys.length; i++) {
                        if (kid == keys[i].kid) {
                            key_index = i;
                            break;
                        }
                }
                if (key_index == -1) {
                    console.log('Public key not found in jwks.json');
                    throw new Error('Public key not found in jwks.json');
                }
                // construct the public key
                jose.JWK.asKey(keys[key_index]).
                then(function(result) {
                    // verify the signature
                    jose.JWS.createVerify(result).
                    verify(token).
                    then(function(result) {
                        // now we can extract the claims
                        var claims = JSON.parse(result.payload);
                        // we need to verify the token expiration...
                        var current_ts = Math.floor(new Date() / 1000);
                        if (current_ts > claims.exp) {
                            throw new Error('Token has expired');
                        }
                        // ...and the audience (i.e. the token has come from the correct user pool)
                        if (claims.aud != app_client_id) {
                            throw new Error('Token was not issued for this audience');
                        }
                        
                        //At this point, the claims are valid. We can use them from here
                        var validClaims = {
                        };
  
                        callback(validClaims);

                    });
                });
            });
        }
    });
};
