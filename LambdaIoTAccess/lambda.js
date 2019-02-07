//Log on to Cognito, establish AWS credentials then display the result
const region = 'eu-west-2';
const userPoolId = 'eu-west-2_6Qk8UHkl5';
const cognitoAppId = '41pboo7igtsbm6bfi18sje5p96';
const identityPool = 'eu-west-2:72c461e0-ca5f-47ce-882e-bee6cc92812b';
const cognitoLogin = 'cognito-idp.'+region+'.amazonaws.com/'+userPoolId;
const iotEndpoint = 'ah0p1efr5o1cl-ats.iot.eu-west-2.amazonaws.com';
const topic = 'iotdemo/lambda/schedule';

var pahoClient;

function testLambda(params) {

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
						token:idToken
					}

					//Ensure policy is attached to cognito user
					var params = {
						FunctionName: 'demoLambdaIoTAccess',
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
							
							//Subscribe to IoT 
						    var requestUrl = SigV4Utils.getSignedUrl(iotEndpoint, region, AWS.config.credentials);
						    
						    subscribe(requestUrl);
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

//Publish a message to our IoT Topic
function publishMessage(payload) {
    message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    pahoClient.send(message);
}

//Subscribe to an IoT Topic
function subscribe(requestUrl) {
	console.log('URL: '+requestUrl);
    var clientId = String(Math.random()).replace('.', '');
    pahoClient = new Paho.MQTT.Client(requestUrl, clientId);
    var connectOptions = {
        onSuccess: function () {
            console.log('connected');

            //subscribe to the topic as soon as we are connected
            pahoClient.subscribe(topic);
            
            alert('Connected to IoT');
            document.getElementById("messageButton").disabled = false; 
            
        },
        useSSL: true,
        timeout: 3,
        mqttVersion: 4,
        onFailure: function (err) {
            alert('IoT connect failed '+JSON.stringify(err));
        }
    };
    pahoClient.connect(connectOptions);

    pahoClient.onMessageArrived = function (message) {
	    try {
	        console.log("message: " +  message.payloadString);
	        newMessage(message.payloadString)
	    } catch (e) {
	        console.log("error: " + e);
	    }
    };
}

function newMessage(message) {
	var messageElement = document.getElementById('iotMessage');
	setTimeout(function() {
		messageElement.classList.remove("flash");
	}, 650);
	messageElement.innerHTML = message;

	messageElement.classList.add("flash");
}