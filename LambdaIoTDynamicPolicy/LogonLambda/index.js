var https = require('https');
var jose = require('node-jose');

var AWS = require('aws-sdk');
var iot = new AWS.Iot({apiVersion: '2015-05-28'});

var region = 'eu-west-2';
var userpool_id = 'eu-west-2_6Qk8UHkl5';
var app_client_id = '41pboo7igtsbm6bfi18sje5p96';
var keys_url = 'https://cognito-idp.' + region + '.amazonaws.com/' + userpool_id + '/.well-known/jwks.json';

exports.handler = (event, context, callback) => {
	var token = event.token;
	try {
		validateToken(token, function(result) {
			//Claims are valid at this point

			//Attach our IoT policy to our the cognitio identity of the 
			//  user who is logging in. NB both this AND the IAM policy for IoT are needed for
			//  a cognito user to be granted access to IoT
			var params = {
				//IoT Policy that allows access to /iotdemo/lambda/schedule topic
				policyName: 'demoSchedule',
				target: context.identity.cognitoIdentityId
			};

			iot.attachPolicy(params, function(err, data) {
				var response;

				if (err) {
					console.log(err, err.stack); // an error attaching policy
					response = {
							statusCode: 500,
							body: JSON.stringify(err),
					};

				} else {
					console.log(data);           // policy attached
					response = {
							statusCode: 200,
							body: JSON.stringify(data),
					};
				}

				callback(null, response);    

			});

		});

	} catch (e) {
		callback(e);
	}
};

var validateToken = (token, callback) => {
	if (token === undefined) {
		throw new Error('No JWTToken in request');
	}

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
								testAttribute:claims['custom:testAttribute']
						};

						callback(validClaims);

					});
				});
			});
		}
	});
};
