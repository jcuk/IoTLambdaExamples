var cognitoUser;

const region = 'eu-west-2';

AWS.config.region = region;

const userPoolId = 'eu-west-2_6Qk8UHkl5';
const cognitoAppId = '41pboo7igtsbm6bfi18sje5p96';
const identityPool = 'eu-west-2:72c461e0-ca5f-47ce-882e-bee6cc92812b';
const cognitoLogin = 'cognito-idp.'+region+'.amazonaws.com/'+userPoolId;

//Log on to Cognito then display the result
function cognitoLogon(params) {

//	Single user available 'testUser' with password 'Password1';

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
			UserPoolId : userPoolId,
			ClientId : cognitoAppId
	};
	var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(poolData);

	var userData = {
			Username : user,
			Pool : userPool
	};

	AWS.config.region = region;

	//Authenticate with Cognito
	cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
	cognitoUser.authenticateUser(authenticationDetails, {
		onSuccess: function (result) {
			alert('Sucessful Cognito Log On');

			var cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
			cognitoUser.authenticateUser(authenticationDetails, {
				onSuccess: function (result) {
					var idToken = result.idToken.jwtToken;

//					console.log(idToken);

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
			cognitoUser.completeNewPasswordChallenge('AdminPassword#1', usrAttributes, this);
		}
	});
}

function changeAttributeValue(params) {
	if (cognitoUser === undefined) {
		alert('Not logged in');
		return;
	}

	AWS.config.credentials.get(function(err) {
		if (err) {
			alert(err);
			console.log(err);
		} else {

			const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
				apiVersion: '2016-04-18'
			});

			var attributeList = [];
			var attribute = {
					Name : 'custom:'+params.formAttribute.value,
					Value : params.formAttributeValue.value
			};

			attributeList.push(attribute);

			cognitoidentityserviceprovider.adminUpdateUserAttributes( {
				UserAttributes: attributeList,
				UserPoolId: userPoolId,
				Username: 'testUser'
			},
			function(err, data) {
				if (err){
					alert("Error updating attributes: "+err);
				} else {
					alert("Updated attribute");
				}
			}
			);
		}
	});
}