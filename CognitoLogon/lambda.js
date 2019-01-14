function testLambda(params) {
	
//	var user = 'testUser';
//	var pass = 'Password1';
	
	var user = params.formUserName.value;
	var pass = params.formPassword.value
	
	var authenticationData = {
        Username : user,
        Password : pass,
    };

	// Need to provide placeholder keys unless unauthorised user access is enabled for user pool
	AWSCognito.config.update({accessKeyId: 'anything', secretAccessKey: 'anything'})

	var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);

	var poolData = {
			UserPoolId : 'eu-west-2_6Qk8UHkl5',
			ClientId : '41pboo7igtsbm6bfi18sje5p96'
	};
	var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(poolData);

	var userData = {
			Username : user,
			Pool : userPool
	};
	
	AWS.config.region = 'us-west-2';

    var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
            var accessToken = result.getAccessToken().getJwtToken();
            var idToken = result.idToken.jwtToken;
            
            console.log(idToken);
            
            AWS.config.update({
	              credentials: new AWS.CognitoIdentityCredentials({
	              	IdentityPoolId: 'eu-west-2:72c461e0-ca5f-47ce-882e-bee6cc92812b',
	                Logins: {
	                    'cognito-idp.eu-west-2.amazonaws.com/eu-west-2_6Qk8UHkl5': result.getIdToken().getJwtToken()
	                }
	              }),
	              region: 'eu-west-2'
	            });
            
            AWS.config.credentials.get(function(err) {
				if (err) {
					console.log(err);
				} else {
					console.log("Retrieved credentials");
					
		            //Call lambda
		            var lambda = new AWS.Lambda();
					var payload = {
						token : idToken
					}
					var params = {
					  FunctionName: 'simpleLambda',
					  InvocationType: 'RequestResponse',
					  LogType: 'Tail',
					  Payload: JSON.stringify(payload),
					};
					lambda.invoke(params, function(err, data) {
					  if (err) {
					  	console.log(err, err.stack);
					  } else {
						console.log('Lambda called');
					    alert('Sucessful Cognito Log On')
					  }
					});
				}
			});
            

        },

        onFailure: function(err) {
            alert(err);
        },
        
	    newPasswordRequired: function(usrAttributes, requiredAttributes) {	    	
	    	alert('New password required');
	    	delete usrAttributes.email_verified;
	    	cognitoUser.completeNewPasswordChallenge('Password1', usrAttributes, this);
	    }
    });
 }