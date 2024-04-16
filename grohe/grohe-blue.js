/**
* Created by Karl-Heinz Wind
* Adapted by coserotondo
**/

module.exports = function (RED) {
    "use strict";
    let ondusApi = require('./ondus-api.js');
    	
    function sleep(ms) {
        return new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      }

    // check if the input is already a date, if not it is probably a value in milliseconds. 
    function convertToDate(input) {
        let date = new Date(input);
        return date;
    }

    // Converts a status object to json. 
    function convertStatus(status) {
        let convertedStatus = {};

        for (let i=0; i < status.length; i++) {
            let item = status[i];
            convertedStatus[item.type] = item.value;
        }

        return convertedStatus;
    }

    // Converts notifications to a notification with text. 
    function convertNotifications(notifications) {
        let convertedNotifications = [];

        for (let i=0; i < notifications.length; i++) {
            let notification = notifications[i];
            let convertedNotification = ondusApi.convertNotification(notification);
            convertedNotifications.push(convertedNotification);
        }

        return convertedNotifications;
    }

    // --------------------------------------------------------------------------------------------
    // The configuration node
    // holds the username and password
    // and establishes the connection to the server
    function GroheLocationNode(n) {
        RED.nodes.createNode(this, n);

        let node = this;
        node.config = n;
        node.locationName = n.location;
        node.connected = false;

        node.appliancesByRoomName = {};
        
        if(node.credentials !== undefined && node.credentials.username !== undefined && node.credentials.password !== undefined 
            && node.credentials.username !== '' && node.credentials.password !== '') {

            (async() => {

                try {
                    node.session = await ondusApi.login(node.credentials.username, node.credentials.password);
                    
                    let response = await node.session.getDahsboard();
                    let dashboard = JSON.parse(response.text);

                    let locations = dashboard.locations

                    for (let i = 0; i < locations.length; i++) {
                        let location = locations[i];
                            
                        if (location.name === node.locationName){
                            node.location = location;
                            node.log('location ' + location.name);
                        
                            node.rooms = location.rooms;
                        
                            for (let j = 0; j < node.rooms.length; j++) {
                                let room = node.rooms[j];
                                node.log('    room ' + room.name);
                        
                                let appliances = room.appliances;
                                node.appliancesByRoomName[room.name] = {
                                    room : room,
                                    appliances : appliances,
                                };

                                for (let k = 0; k < appliances.length; k++) {
                                    let appliance = appliances[k];
                                    node.log('        appliance ' + appliance.name);
                                }
                            }

                            node.connected = true;
                            node.emit('initialized');
                            break;
                        }
                        else {
                            // not used.
                        }
                    }

                }
                catch (exception){
                    node.connected = false;
                    node.emit('initializeFailed', exception);
                    node.warn(exception);
                }    
            })()
        }
        else {
            node.connected = false;
            node.emit('initializeFailed', 'credentials missing');
            node.warn('credentials missing');
        }

        this.on('close', function (done) {
            ondusApi.logoff(node.session);
            node.session = {};
            node.location = {};
            node.rooms = {};
            node.appliancesByRoomName = {};
            node.connected = false;
            done();
        });

        this.getApplianceIds = function (roomName, applianceName) {
        
            let applianceIds;
          
            if (node.appliancesByRoomName[roomName] !== undefined) {
                let value = node.appliancesByRoomName[roomName];

                let appliances = value.appliances;
                let room = value.room;
                for (let i = 0; i < appliances.length; i++) {
                    let appliance = appliances [i];

                    if (appliance.name === applianceName) {
                        applianceIds = {
                            locationId : node.location.id,
                            roomId : room.id,
                            applianceId : appliance.appliance_id // why not id here? 
                        };

                        break;
                    }
                }
            }

            return applianceIds;
        };
    }

    RED.nodes.registerType('grohe location', GroheLocationNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" },
        }
    });
	
	
    // --------------------------------------------------------------------------------------------
    // The blue home node controls a grohe blue home.
    function GroheBlueHomeNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        node.location = config.location;
        node.roomName = config.room.trim();
		node.applianceName = config.appliance.trim();
        node.devicetype = Number(config.devicetype);

		node.config = RED.nodes.getNode(node.location);
        if (node.config) {
               
            node.locationId = node.config.locationId;

            node.status({ fill: 'red', shape: 'ring', text: 'initializing' });

            node.onInitialized = function () {
            
                node.applianceIds = node.config.getApplianceIds(node.roomName, node.applianceName);
                if (node.applianceIds !== undefined){
                    node.status({ fill: 'green', shape: 'ring', text: 'connected' });
    
                    node.on('input', async function (msg) {

                        try
                        {
                            node.status({ fill: 'green', shape: 'ring', text: 'updating...' });

                            if (msg.payload !== undefined && msg.payload.command !== undefined){
                                let data = msg.payload;
                                data.type = node.devicetype;
                                let startDate = new Date();
                                let startTime = startDate.getTime()
                                let response = await node.config.session.setApplianceCommand(
                                    node.applianceIds.locationId,
                                    node.applianceIds.roomId,
                                    node.applianceIds.applianceId,
                                    data);
                                // Hint: response is not used right now.
                                
                                let i = 0;
                                let eventTime = 0;
                                // Try to wait to get the latest measurement from device
                                if (msg.payload.command.get_current_measurement == true){
                                    node.warn("get_current_measurement");
                                    do {
                                        await sleep(1000 + (i * 1000));
                                        i += 10;
                                        let responseDataLatest = await node.config.session.getApplianceDataLatest(
                                            node.applianceIds.locationId,
                                            node.applianceIds.roomId,
                                            node.applianceIds.applianceId);
                                        let dataLatest = JSON.parse(responseDataLatest.text);
                                        let measurementTimestamp = dataLatest.data_latest.measurement.timestamp;
                                        let eventDate = new Date(measurementTimestamp);
                                        eventTime = eventDate.getTime()
                                    } while (i < 9 && eventTime < startTime);
                                }

                            }

                            let responseDetails = await node.config.session.getApplianceDetails(
                                node.applianceIds.locationId,
                                node.applianceIds.roomId,
                                node.applianceIds.applianceId);
                            let details = JSON.parse(responseDetails.text);

                            let responseNotifications = await node.config.session.getApplianceNotifications(
                                node.applianceIds.locationId,
                                node.applianceIds.roomId,
                                node.applianceIds.applianceId);
                            let notifications = JSON.parse(responseNotifications.text);

                            // For Debugging only
                            if (msg.debug === true){
                                let  debugMsg = {
                                    debug : {
                                        applianceIds : node.applianceIds,
                                        details : details,
                                        notifications : notifications
                                    }
                                };
                                node.warn(debugMsg);
                            }

                            let result = {};
                            
                            if(details != null){
                                if(details.info != null){
                                    result.info = details.info;
                                }
                                if(details.status != null){
                                    result.status = convertStatus(details.status);
                                }
                                if(details.data_latest.measurement != null){
                                    result.measurement = details.data_latest.measurement;
                                }
                                result.details = details;
                            }

                            if(notifications != null){
                                result.notifications = convertNotifications(notifications);
                            }

                            let response4 = await node.config.session.getApplianceCommand(
                                node.applianceIds.locationId,
                                node.applianceIds.roomId,
                                node.applianceIds.applianceId);
                            let command = JSON.parse(response4.text);
                            result.command = command.command;
                            result.commandTimestamp = command.timestamp;
                        
                            msg.payload = result;
                            node.send([msg]);
                            
                            let notificationCount = 0;
                            if(notifications !== undefined){
                                notificationCount = notifications.length;
                            }

                            if (notificationCount == 0){
                                node.status({ fill: 'green', shape: 'ring', text: 'ok' });
                            }
                            else {
                                node.status({ fill: 'yellow', shape: 'dot', text: notificationCount + ' notifications' });
                            }
                        }
                        catch (exception){
                            let errorMessage = 'Caught exception: ' + exception.message;
                            node.error(errorMessage, msg);
                            node.status({ fill: 'red', shape: 'ring', text: 'failed' });
                        }
                    });
                }   
                else {
                    node.status({ fill: 'red', shape: 'ring', text: node.applianceName + ' not found ' });
                }     

            };
            node.config.addListener('initialized', node.onInitialized);

            node.onError = function (errorMessage) {
                node.status({ fill: 'red', shape: 'ring', text: errorMessage });
            };
            node.config.addListener('initializeFailed', node.onError);

            this.on('close', function () {
                if (node.onInitialized) {
                    node.config.removeListener('initialized', node.onInitialized);
                }

                if (node.onError) {
                    node.config.removeListener('initializeFailed', node.onError);
                }
    
                node.status({});
            });
        }
        else {
            node.status({ fill: 'red', shape: 'ring', text: 'no config' });
        }
    }
    RED.nodes.registerType("grohe blue home", GroheBlueHomeNode);
}
