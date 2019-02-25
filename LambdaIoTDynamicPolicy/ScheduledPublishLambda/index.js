var AWS = require('aws-sdk');

var iotdata = new AWS.IotData({endpoint:"ah0p1efr5o1cl-ats.iot.eu-west-2.amazonaws.com"});

exports.handler = function(event, context, callback) {
    const currentTime = new Date();
    const temperature = Math.floor((Math.random() * 40) + 5);
    const pressure = Math.floor((Math.random() * 50) + 990);
    const coolant = Math.floor((Math.random() * 50) + 50);
    const fuel = Math.floor((Math.random() * 20) + 500);

    publish('iotdemo/lambda/schedule','Hello from Lambda at '+currentTime);
    publish('iotdemo/organisation/department1/zoneA/temperature','Temperature is '+ temperature);
    publish('iotdemo/organisation/department1/zoneB/fuel','Fuel level is '+ fuel);
    publish('iotdemo/organisation/department2/zoneA/coolant','Coolant level is '+ coolant);
    publish('iotdemo/organisation/department2/zoneB/pressure','Pressure is '+ pressure);

    callback();
};

//Publish a message to IoT
var publish = (topic, payload) => {
    iotdata.publish({
        topic: topic,
        payload: payload,
        qos: 0
    }, (err, data) => {
        if(err){
            console.log("Error occured : ",err);
        }
    });
};