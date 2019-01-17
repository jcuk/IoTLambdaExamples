//Log on to Cognito, establish AWS credentials then display the result 
function testLambda(params) {

//	Single user available 'testUser' with password 'Password1';

	var user = params.formUserName.value;
	var pass = params.formPassword.value

	var region = 'eu-west-2';
	var userPool = 'eu-west-2_6Qk8UHkl5';
	var cognitoAppId = '41pboo7igtsbm6bfi18sje5p96';
	var identityPool = 'eu-west-2:72c461e0-ca5f-47ce-882e-bee6cc92812b';
	var cognitoLogin = 'cognito-idp.'+region+'.amazonaws.com/'+userPool;

	var authenticationData = {
			Username : user,
			Password : pass,
	};

	// Need to provide placeholder keys unless unauthorised user access is enabled for user pool
	AWSCognito.config.update({accessKeyId: 'anything', secretAccessKey: 'anything'})

	var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);

	var poolData = {
			UserPoolId : userPool,
			ClientId : cognitoAppId
	};
	var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(poolData);

	var userData = {
			Username : user,
			Pool : userPool
	};

	AWS.config.region = region;

	//Authenticate with Cognito
	var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
	cognitoUser.authenticateUser(authenticationDetails, {
		onSuccess: function (result) {
			var idToken = result.idToken.jwtToken;

			//console.log(idToken);

			//Cognito logon sucessful. Update our configuration with our JWT Token
			AWS.config.update({
				credentials: new AWS.CognitoIdentityCredentials({
					IdentityPoolId: identityPool,
					Logins: {
						[cognitoLogin] : idToken
					}
				}),
				region: region
			});

			//Now use our cognito logon to get our AWS credentials
			AWS.config.credentials.get(function(err) {
				if (err) {
					alert(err);
					console.log(err);
				} else {
					console.log("Retrieved credentials");

					//AWS credentials are now established - call the lambda
					var lambda = new AWS.Lambda();
					var payload = {
					}

					var params = {
							FunctionName: 'simpleLambda',
							InvocationType: 'RequestResponse',
							LogType: 'Tail',
							Payload: JSON.stringify(payload),
					};

					//Invoke the lambda and parse the response
					lambda.invoke(params, function(err, data) {
						if (err) {
							alert(err);
							console.log(err, err.stack);
						} else {
							console.log('Lambda called');
							var response = JSON.parse(data.Payload);
							alert('Sucessful Cognito Log On. Lambda executed: '+response.body);
						}
					});
				}
			});
		},

		//Login failure
		onFailure: function(err) {
			alert(err);
		},

		//New password flow. Only used for first log in
		newPasswordRequired: function(usrAttributes, requiredAttributes) {	
			alert('New password required');
			delete usrAttributes.email_verified;
			cognitoUser.completeNewPasswordChallenge('Password1', usrAttributes, this);
		}
	});
}