var Observable = require("data/observable").Observable;
//Module to save local data
var appSettings = require("application-settings");
var frames = require("ui/frame");


//Connection with Firebase for login
var firebase = require("nativescript-plugin-firebase");

//Re-check connectivity
var connectivity = require("tns-core-modules/connectivity");

var appversion = require("nativescript-appversion");

var dialogs = require("ui/dialogs");



//var orientation = require('nativescript-orientation');
//orientation.disableRotation(); // The screen will no longer rotate 

//get ready for Facebook info
var fbUID;
fbUID = appSettings.setString("uid", "");

var fbEmail;
var versao;

appversion.getVersionName().then(function(v) {
    console.log("Your app's version is: " + v);
    //versao = "version "+v;
    versao = v;
});


//Preloads data if they don't exist yet
var fbMeasurement = appSettings.getString("system", "imperial");
var fbName = appSettings.getString("name", "");
var fbNick = appSettings.getString("nick", "");
var fbPhoto = appSettings.getString("photo", "res://ic_photo");
var fbMain = appSettings.getString("mainColor", "#FF0000");
var fbSec = appSettings.getString("secColor", "#00FF00");
var fbIcon = appSettings.getString("icon", "mk_red_green");
fbUID = appSettings.getString("uid", "");
console.log("fbUID: "+fbUID)

//Show "Ride Alone" alert
var showAloneAlert = appSettings.getNumber("showAloneAlert", 1); //1 means show alert

//Get current location
var geolocation = require("nativescript-geolocation");
if (!geolocation.isEnabled()) {
        geolocation.enableLocationRequest();
}

function createViewModel() {
    var viewModel = new Observable();

    //Settings page
    viewModel.onSettings = function() {
        var navOptions = {moduleName:"settings-page"}
        frames.topmost().navigate("settings-page");
    }

    viewModel.version = versao;

    // Validating connectivity
    var connectionType = connectivity.getConnectionType();
    switch (connectionType) {
        case connectivity.connectionType.none:
            console.log("No connection");
            dialogs.confirm({
                title: L('notConnectedTitle'),
                message: L('notConnected'),
                okButtonText: "OK",
            }).then(function (result) {
                // result argument is boolean
                console.log("Dialog result: " + result);
            });
            break;
        case connectivity.connectionType.wifi:
            console.log("** WiFi connection");
            break;
        case connectivity.connectionType.mobile:
            console.log("** Mobile connection");
            break;
    }


    //code for Fly Offline
    viewModel.onTapOff = function() {
        if(showAloneAlert) {
            dialogs.confirm({
                title: "Ride Alone",
                message: "Ride Alone means you are not going to see (neither be seen by) other users.",
                okButtonText: "OK",
                cancelButtonText: "Cancel",
                neutralButtonText: "Don't Show Again"
            }).then(function (result) {
                // result argument is boolean
                console.log("Dialog result: " + result);
                if (result) { 
                    //get credentials name, uid, glider color from user database
            
                    //move to next page
                    console.log("go to next page")
                    var navOptions = {moduleName:"dashboard-page"}
                    frames.topmost().navigate("dashboard-page");
                    //application.start({ moduleName: "dashboard-page" });

                } else if (result===undefined) {
                    appSettings.setNumber("showAloneAlert", 0); //0 means don't show alert again
                    var navOptions = {moduleName:"dashboard-page"}
                    frames.topmost().navigate("dashboard-page");
                } else {
                    //do nothin
                    console.log("keep in this page")

                }
            });
        } else {
            //move to next page
            console.log("go to next page")
            var navOptions = {moduleName:"dashboard-page"}
            frames.topmost().navigate("dashboard-page");
        }
    }

    viewModel.onTap = function() {
        if (fbUID!="") {
            //var navOptions = {moduleName:"dash_live-page",context:{fbPhoto:fbPhoto, fbName:fbName }}
            //frames.topmost().navigate(navOptions);
            var navigationEntry = {
                moduleName: "dash_live-page",
                animated: true,
                transition: {
                    name: "fade",
                    duration: 380,
                    curve: "easeIn", clearHistory: true
                }
            };
            frames.topmost().navigate(navigationEntry);
        } else {
            firebase.login({
                type: firebase.LoginType.FACEBOOK,
                facebookOptions: {
                    scope: ['public_profile', 'email'] // optional: defaults to ['public_profile', 'email']
                }
            }).then(
                function (result) {
                    JSON.stringify(result);
                    //alert(JSON.stringify(result));
                    fbName = result.name;
                    fbPhoto = result.profileImageURL;
                    console.log("Foto facebook: "+fbPhoto)
                    fbUID = result.uid;
                    fbEmail = result.email;  

                    appSettings.setString("uid", fbUID);
                    appSettings.setString("nick", fbNick);
                    appSettings.setString("photo", fbPhoto);
                    appSettings.setString("icon", fbIcon);
                    appSettings.setString("name", fbName);
                    appSettings.setString("email", fbEmail);


                    //check if user already exists in the database
                    var onQueryEvent = function(result) {            
                        // note that the query returns 1 match at a time
                        // in the order specified in the query
                        if (!result.error) {
                            var data = JSON.parse(JSON.stringify(result.value))
                            if (JSON.stringify(result.value)==="null") {
                                console.log("novo usuario")

                                firebase.setValue(
                                    'users/'+fbUID,
                                    {
                                        uid: fbUID, 
                                        name: fbName, 
                                        photo: fbPhoto, 
                                        mainColor: fbMain, 
                                        secColor: fbSec, 
                                        nick: fbNick, 
                                        icon: fbIcon,
                                        measurement: fbMeasurement,
                                        migrated: "temp"
                                    }
                                );
                            
                                //var navOptions = {moduleName:"settings-page",context:{fbPhoto:fbPhoto, fbName:fbName }}
                                //frames.topmost().navigate(navOptions);
                                var navigationEntry = {
                                    moduleName: "settings-page",
                                    animated: true,
                                    transition: {
                                        name: "fade",
                                        duration: 380,
                                        curve: "easeIn", clearHistory: true
                                    }
                                };
                                frames.topmost().navigate(navigationEntry);

                            } else {
                                console.log("usuario existente");
                                //set values
                                
                                //console.log(Object.keys(data).length)
                                fbMain = data[fbUID].mainColor;
                                fbSec = data[fbUID].secColor;
                                fbNick = data[fbUID].nick;
                                fbIcon = data[fbUID].icon;
                                fbPhoto = data[fbUID].photo;

                                //Save local for future use
                                appSettings.setString("system", fbMeasurement);
                                appSettings.setString("name", fbName);
                                appSettings.setString("nick", fbNick);
                                appSettings.setString("photo", fbPhoto);
                                appSettings.setString("mainColor", fbMain);
                                appSettings.setString("secColor", fbSec);
                                appSettings.setString("uid", fbUID);
                                appSettings.setString("icon", fbIcon);

                                //var navOptions = {moduleName:"dashLive-page",context:{fbPhoto:fbPhoto, fbName:fbName }}
                                //var navOptions = {moduleName:"dash_live-page",context:{fbPhoto:fbPhoto, fbName:fbName }}
                                //frames.topmost().navigate(navOptions);
                                var navigationEntry = {
                                    moduleName: "dash_live-page",
                                    animated: true,
                                    transition: {
                                        name: "fade",
                                        duration: 380,
                                        curve: "easeIn", clearHistory: true
                                    }
                                };
                                frames.topmost().navigate(navigationEntry);
                                
                            }

                        } 
                    }
                
                    //ends onQueryEvent
                    firebase.query(
                        onQueryEvent,
                        "/users",
                        {
                            // set this to true if you want to check if the value exists or just want the event to fire once
                            // default false, so it listens continuously.
                            // Only when true, this function will return the data in the promise as well!
                            singleEvent: true,
                            // order by company.country
                            orderBy: {
                                type: firebase.QueryOrderByType.KEY
                                //type: firebase.QueryOrderByType.CHILD,
                                //value: 'uid' // mandatory when type is 'child'
                            },
                            range: {
                                type: firebase.QueryRangeType.EQUAL_TO,
                                value: fbUID
                            },
                            limit: {
                                type: firebase.QueryLimitType.LAST,
                                value: 1
                            }
                        }
                    )
                },
                function (errorMessage) {
                    alert(errorMessage);
                    console.log("passou aqui")
                    firebase.reauthenticate({type: firebase.LoginType.FACEBOOK})
                }
            ); 

        } //closes firebase login
    } //closes fbUID check

    viewModel.onTapEmail = function() {
        var navigationEntry = {
                moduleName: "email-page",
                animated: true,
                transition: {
                    name: "fade",
                    duration: 380,
                    curve: "easeIn", clearHistory: true
                }
            };
            frames.topmost().navigate(navigationEntry);



        /*
        if (fbUID!="") {
            var navigationEntry = {
                moduleName: "dash_live-page",
                animated: true,
                transition: {
                    name: "fade",
                    duration: 380,
                    curve: "easeIn", clearHistory: true
                }
            };
            frames.topmost().navigate(navigationEntry);
        } else {
            //goes to email page
            console.log("going to email page")

            var navigationEntry = {
                moduleName: "email-page",
                animated: true,
                transition: {
                    name: "fade",
                    duration: 380,
                    curve: "easeIn", clearHistory: true
                }
            };
            frames.topmost().navigate(navigationEntry);

        } //closes email login
        */
    } //closes fbUID check


    return viewModel;
}

exports.createViewModel = createViewModel; 
