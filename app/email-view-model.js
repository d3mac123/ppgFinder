var Observable = require("data/observable").Observable;
var frames = require("ui/frame");
var dialogs = require("ui/dialogs");
//Module to save local data
var appSettings = require("application-settings");

//Connection with Firebase for login
var firebase = require("nativescript-plugin-firebase");


//get ready for Facebook or Local info
var fbUID = "";
var fbZoomLevel = appSettings.getString("zoomLevel", "13");
var fbIcon = appSettings.getString("icon", "mk_red_green");
var fbNick = appSettings.getString("nick", "");
var fbName = appSettings.getString("name", "");
var fbPhoto = appSettings.getString("photo", "res://ic_photo");
var fbMeasurement = appSettings.getString("system", "imperial");
var selectedMap = appSettings.getString("map", "Streets");
var fbMain = appSettings.getString("secColor", "#FF0000");
var fbSec = appSettings.getString("mainColor", "#00FF00");
var fbEmail = appSettings.getString("email", "");
console.log("fbEmail: "+fbEmail)
//var fbEmail
var fbPassword


function createViewModel(args) {
    var viewModel = new Observable();
    var page = args;

    viewModel.email = fbEmail;

    //reset password
    viewModel.resetPassword = function() {
        if (viewModel.email=="") {
            alert(L('resetError'))
        } else {
            firebase.resetPassword({
                email: viewModel.email
            }).then(
                function () {
                    // called when password reset was successful,
                    // you could now prompt the user to check his email
                    alert(L('resetEmail'))
                },
                function (errorMessage) {
                    console.log(errorMessage);
                }
            );
        }
    }  

    viewModel.loginEmail = function() {
        
        var fbEmail = viewModel.email;
        var fbPassword = viewModel.password;
        console.log("Login "+fbEmail+" >"+fbPassword+" uid: "+fbUID)
        firebase.login({
            type: firebase.LoginType.PASSWORD,
            passwordOptions: {
            email: fbEmail,
            password: fbPassword
            }
        }).then(
            function (result) {
                console.log(JSON.stringify(result));
                //fbUID = String(result.key);
                fbUID = String(result.uid);
                //console.log("porra do uid: "+fbUID+" -> (uid): "+String(result.uid))   
                appSettings.setString("uid", fbUID);
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
                                    name: "", 
                                    photo: fbPhoto, 
                                    mainColor: fbMain, 
                                    secColor: fbSec, 
                                    nick: "", 
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

                            //fbUID = data[fbUID].uid;
                            console.log("velho uid: "+fbUID)
                            
                            //Save local for future use
                            appSettings.setString("system", fbMeasurement);
                            appSettings.setString("name", fbName);
                            appSettings.setString("nick", fbNick);
                            appSettings.setString("photo", fbPhoto);
                            appSettings.setString("mainColor", fbMain);
                            appSettings.setString("secColor", fbSec);
                            appSettings.setString("uid", fbUID);
                            appSettings.setString("icon", fbIcon);
                            appSettings.setString("email", fbEmail);

                            //var navOptions = {moduleName:"dashLive-page",context:{fbPhoto:fbPhoto, fbName:fbName }}
                            //var navOptions = {moduleName:"dash_live-page",context:{fbPhoto:fbPhoto, fbName:fbName }}
                            //frames.topmost().navigate(navOptions);
                            var navigationEntry = {
                                moduleName: "dash_live-page",
                                animated: true,
                                clearHistory: true,
                                transition: {
                                    name: "fade",
                                    duration: 380,
                                    curve: "easeIn"
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
            }
        );

    }


    viewModel.createEmail = function() {
        console.log("Creating new account")

        //save data to Firebase
        var fbEmail = viewModel.email;
        var fbPassword = viewModel.password;

        console.log("fbEmail: "+fbEmail+"-> "+fbPassword)
        firebase.createUser({
            email: fbEmail,
            password: fbPassword
        }).then(
            function (result) {
                console.log(JSON.stringify(result)); 
                fbUID = String(result.key);
                console.log("New user created: "+fbUID)
                appSettings.setString("uid", fbUID);
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
                                    name: "", 
                                    photo: fbPhoto, 
                                    mainColor: fbMain, 
                                    secColor: fbSec, 
                                    nick: "", 
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

                            
                            //Save local for future use
                            appSettings.setString("system", fbMeasurement);
                            appSettings.setString("name", fbName);
                            appSettings.setString("nick", fbNick);
                            appSettings.setString("photo", fbPhoto);
                            appSettings.setString("mainColor", fbMain);
                            appSettings.setString("secColor", fbSec);
                            appSettings.setString("uid", fbUID);
                            appSettings.setString("icon", fbIcon);
                            appSettings.setString("email", fbEmail);

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
                dialogs.alert({
                title: "No user created",
                message: errorMessage,
                okButtonText: "OK, got it"
                })
            }
        );


    }

    return viewModel;
}

exports.createViewModel = createViewModel;
