const https = require('https');
const jose = require('node-jose');
const AWS = require('aws-sdk');
const iot = new AWS.Iot({apiVersion: '2015-05-28'});

const region = 'eu-west-2';
const userpool_id = 'eu-west-2_6Qk8UHkl5';
const app_client_id = '41pboo7igtsbm6bfi18sje5p96';
const keys_url = 'https://cognito-idp.' + region + '.amazonaws.com/' + userpool_id + '/.well-known/jwks.json';

const baseTopic = 'iotdemo/organisation';
const basePolicyName = 'iotdemo-organisation-dep';

exports.handler = (event, context, callback) => {
    var token = event.token;
    try {
        validateToken(token, (claims) => {
            //Claims should now contain department and zone. Form the allowed topic...
            const topic = makeTopic(claims);
            claims.topic = topic;

            // .. and the canonical policy name for this topic
            const policyName = makePolicyName(claims);

            //...and prepare to attach the policy to the cognito identity
            const attachPolicyParmas = {
				policyName: policyName,
				target: context.identity.cognitoIdentityId
            };

            //Create a policy (if we need one), remove all old policies, then
            //  attach our new policy to our user
            createPolicyIfNotExists(policyName, topic)
                .then(() => listAllIoTPolicies(context.identity.cognitoIdentityId))
                .then((attachedPolicies) => detachPolicies(attachedPolicies, context.identity.cognitoIdentityId))
                .then(() => iot.attachPolicy(attachPolicyParmas).promise())
                .then((result) => {
                    console.log('Policy '+policyName+' attached');
                    const response = {
                        statusCode: 200,
                        body: JSON.stringify(claims),
                    };
                    callback(null, response);
                })
                .catch((error) => {
                    console.log('Error managing IoT policy');
                    console.log(error.stack);
                    callback(error);
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
                        	zone:claims['custom:zone'],
                        	department:claims['custom:department']
                        };

                        console.log('claims:'+JSON.stringify(claims));
                        console.log('valid claims'+JSON.stringify(validClaims));

                        callback(validClaims);

                    });
                });
            });
        }
    });
};

// Given the zone and the department a user has access to, form the topic that
//  represents this access
var makeTopic = (claims) => {
    var topic = baseTopic;
    if (claims.department=='*') {
        return topic;
    }
    topic += '/department'+claims.department;
    if (claims.zone=='*') {
        return topic;
    }
    return topic + '/zone'+claims.zone;
};

// Given the zone and the department a user has access to, form the canonical
//  name that the IoT policy for that access will be called
var makePolicyName = (claims) => {
    //iotdemo-organisation-dep<department>-zone<zone>
    var policyName = basePolicyName;

    if (claims.department=='*') {
        policyName+='All';
    } else {
        policyName+=claims.department;
    }

    policyName +='-zone';

    if (claims.zone=='*') {
        policyName+='All';
    } else {
        policyName+=claims.zone;
    }

    return policyName;
};

// Given a policy name and topic, check if that IoT policy exists, and if not
//  create one. Involves multiple async calls, so implemented as a Promise
var createPolicyIfNotExists = (policyName, topic) => {
    return new Promise((resolve, reject) => {
        const iotPolicyParams = {
            policyName: policyName
        };

        iot.getPolicy(iotPolicyParams, (err, data) => {
            if (err) {
                if (err.code === 'ResourceNotFoundException') {
                    console.log('IoT Policy '+policyName+' not found. Creating.');

                    iotPolicyParams.policyDocument = '{"Version": "2012-10-17",'+
                        '"Statement": [{"Effect": "Allow","Action":["iot:connect","iot:subscribe"],'+
                        '"Resource": "*"},{"Effect": "Allow","Action": ["iot:receive","iot:publish"],'+
                        '"Resource": "arn:aws:iot:'+region+':'+process.env.account+':topic/'+topic+'/*"}]}';
                    iot.createPolicy(iotPolicyParams, (err, data) => {
                        if (err) {
                            //Error creating policy
                            reject(new Error(err));
                        } else {
                            console.log('IoT Policy '+policyName+' created');
                            resolve(policyName);
                        }
                    });
                } else {
                    //Error finding policy
                    reject(new Error(err));
                }
            } else {
                //Policy already exists. All ok
                resolve(policyName);
            }
        });
    });
};

//Find all policies attached to the user and return them as an array from a Promise
var listAllIoTPolicies = (target) => {
    return new Promise((resolve, reject) => {
        const params = {
          target: target,
          marker: '',
          pageSize: 100,
          recursive: true
        };

        iot.listAttachedPolicies(params, (err, data) => {
          if (err) {
              reject(new Error(err));
          } else {
              const policyList =[];
              for (let element in data.policies) {
                //console.log('Policy:'+JSON.stringify(data.policies[element].policyName));
                policyList.push(data.policies[element].policyName);
              }
              console.log('Found attached policies: '+policyList);
              resolve(policyList);
          }
        });
    });
};

//Detach all listed policies from the target as a Promise
var detachPolicies = (policyList ,target) => {
    const promisies = [];
    const params = {
        policyName: '',
        target: target
    };

    policyList.forEach((policy) => {
        params.policyName = policy;
        console.log('Detaching policy '+policy);
        promisies.push(iot.detachPolicy(params).promise());
    });

    return Promise.all(promisies);
};
