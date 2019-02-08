var AWS = require('aws-sdk');

var iotdata = new AWS.IotData({endpoint:"ah0p1efr5o1cl-ats.iot.eu-west-2.amazonaws.com"});

exports.handler = function(event, context, callback) {
    
    var currentTime = new Date();
    
    var params = {
        topic: 'iotdemo/lambda/schedule',
        payload: 'Hello from Lambda at '+currentTime,
        qos: 0
    };


    iotdata.publish(params, function(err, data){
        if(err){
            console.log("Error occured : ",err);
        }
    });

    callback();
};