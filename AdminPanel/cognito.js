//Log on to Cognito then display the result
var cognitoUser;

function cognitoLogon(params) {

//	Single user available 'testUser' with password 'Password1';

	var user = params.formUserName.value;
	var pass = params.formPassword.value

	var region = 'eu-west-2';
	var userPool = 'eu-west-2_6Qk8UHkl5';
	var cognitoAppId = '41pboo7igtsbm6bfi18sje5p96';

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
	cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
	cognitoUser.authenticateUser(authenticationDetails, {
		onSuccess: function (result) {
			alert('Sucessful Cognito Log On');
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

function changeAttributeValue(params) {
	if (cognitoUser === undefined) {
		alert('Not logged in');
		return;
	}
	
    var attributeList = [];
    var attribute = {
        Name : 'custom:'+params.formAttribute.value,
        Value : params.formAttributeValue.value
    };
    var attribute = new AmazonCognitoIdentity.CognitoUserAttribute(attribute);
    attributeList.push(attribute);

    cognitoUser.updateAttributes(attributeList, function(err, result) {
        if (err) {
            alert(err);
            return;
        }
        alert('Set Attribute: ' + result);
    });
}