/*
In NativeScript, the app.js file is the entry point to your application.
You can use this file to perform app-level initialization, but the primary
purpose of the file is to pass control to the app’s first module.
*/
//For localization
require('globals');
require('nativescript-i18n');
require("./bundle-config");



var application = require("application");
var appSettings = require("application-settings");

//Tokens for Firebase Cloud Messaging
var FeedbackPlugin = require("nativescript-feedback");
var feedback = new FeedbackPlugin.Feedback();
var FeedbackType = require ("nativescript-feedback").FeedbackType;
var FeedbackPosition = require ("nativescript-feedback").FeedbackPosition;
var color = require("color");

var fbUID;

var geolocation = require("nativescript-geolocation");
if (!geolocation.isEnabled()) {
    geolocation.enableLocationRequest();
 }


//Orientation control
//require("nativescript-orientation")
//require( "nativescript-platform-css" );

// Check for permissions on Android devices
var permissions = require("nativescript-permissions");
permissions.requestPermission([
        "android.permission.INTERNET",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_NETWORK_STATE"
    ], "I need these permissions")
        .then(function (res) {
            console.log("Permissions granted!");
        })
        .catch(function () {
            console.log("No permissions - plan B time!");
        });


// Connectivity check
var connectivity = require("tns-core-modules/connectivity");
var connectionType = connectivity.getConnectionType();
switch (connectionType) {
    case connectivity.connectionType.none:
        console.log("No connection");
        //alert("You are not connected with the Internet. Please connect in order to see maps and other pilots.");
        alert(L('noConnectivity')); //"You are not connected with the Internet. Please connect in order to see maps and other pilots.");
        break;
    case connectivity.connectionType.wifi:
        console.log("WiFi connection");
        console.log(L('wifiConnectivity'));
        //alert("WiFi connection");
        break;
    case connectivity.connectionType.mobile:
        console.log("Mobile connection");
        console.log(L('mobileConnectivity'));
        //alert("Mobile connection");
        break;
}

// Firebase connectivity
const firebase = require("nativescript-plugin-firebase");
const firebaseWebApi = require("nativescript-plugin-firebase/app");
firebase.init({
    // Optionally pass in properties for database, authentication and cloud messaging,
    // see their respective docs.
    url: "https://ppg-finder.firebaseio.com/",
    persist: true,
    storageBucket: 'gs://ppg-finder.appspot.com',
    onMessageReceivedCallback: function(message) {
        console.log("Title: " + message.title);
        console.log("Body: " + message.body);
      // if your server passed a custom property called 'foo', then do this:
     // console.log("Value of 'foo': " + message.data.foo);
        if (String(message.title) != "undefined") {
            feedback.info({
                title: message.title, //"Message from "+result.value[uid]["nick"],
                message: message.body, //result.value[uid]["msg"]+" ("+parseInt(timeLapse)+" sec ago)",
                duration: 5000
            });
        }
     
    },
    onAuthStateChanged: function(data) { // optional but useful to immediately re-logon the user when he re-visits your app
        console.log(data.loggedIn ? "Logged in to firebase" : "Logged out from firebase");
        //alert("logged? "+data.loggedIn+" fbUID: "+fbUID)
        if (data.loggedIn) {
          //console.log("user's email address: " + (data.user.email ? data.user.email : "N/A"));
          //console.log("user's id: " + (data.user.userid ? data.user.userid : "N/A"));
          //fbUID = "5v9FB2urEVcp9u4s6XdnqeZGt0n2"; //appSettings.setString("uid", "");
        } else {
            //alert("Not logged!")
            fbUID = appSettings.setString("uid", "");
        }
      }
    /*,
    onPushTokenReceivedCallback: function(token) {
      console.log("Firebase push token: " + token);
    }
    */

}).then(
    function (instance) {
        console.log("firebase.init done");
    },
    function (error) {
        console.log("firebase.init error: " + error);
    }
);

/*
//Test Firestore
var firebase_firestoreWeb = require("nativescript-plugin-firebase/ppg-finder");
firebase_firestoreWeb.initializeApp({
    persist: false
  });

var placesCollection = firebase.firestore().collection("places");
console.log(placesCollection)
placesCollection.get().then(querySnapshot => {
    querySnapshot.forEach(doc => {
      console.log(`${doc.id} => ${JSON.stringify(doc.data())}`);
    });
  });
*/

/*
application.on(application.launchEvent, function (args) {
    if (args.android) {
        // For Android applications, args.android is an android.content.Intent class.
        console.log("Launched Android application with the following intent: " + args.android + ".");
    } else if (args.ios !== undefined) {
        // For iOS applications, args.ios is NSDictionary (launchOptions).
        console.log("Launched iOS application with options: " + args.ios);
    }
});

application.on(application.suspendEvent, function (args) {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        console.log("UIApplication: " + args.ios);
    }
});

application.on(application.resumeEvent, function (args) {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        console.log("UIApplication: " + args.ios);
    }
});

application.on(application.exitEvent, function (args) {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        console.log("UIApplication: " + args.ios);
    }
});

application.on(application.lowMemoryEvent, function (args) {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        console.log("UIApplication: " + args.ios);
    }
});

application.on(application.uncaughtErrorEvent, function (args) {
    if (args.android) {
        // For Android applications, args.android is an NativeScriptError.
        console.log("NativeScriptError: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is NativeScriptError.
        console.log("NativeScriptError: " + args.ios);
    }
});
*/

/*
//Teste activepilots listview
var cleanActive = [];
var activePilots = [];
var toloop = [{listNick:"alex", listDistance:10},{listNick:"elen", listDistance:1},{listNick:"john", listDistance:5}]
//console.log("ENTRANDO EM FOR LOOP")
for(z=0;z<30;z++) {
    for(i=0;i<toloop.length;i++) {
        var index = cleanActive.indexOf(toloop[i].listNick);
        //console.log("index of "+toloop[i].listNick+": "+index)
        if (index === -1) {     
            //console.log('ADDING ('+toloop[i].listNick+') ')   
            //Adds into the listView
            cleanActive.push(toloop[i].listNick);
            activePilots.push(
                {   listDistance: toloop[i].listDistance,
                    listNick: toloop[i].listNick 
                });
        } else {
            //console.log('UPDATING ('+toloop[i].listNick+') ')                
            //updates ListView
            activePilots.splice(index,1,
            {   listDistance: toloop[i].listDistance,
                    listNick: toloop[i].listNick 
            });
        }
        
        
    } 
    //Sorts the data by DISTANCE
    activePilots.sort(function(a,b) {return (a.listDistance > b.listDistance) ? 1 : ((b.listDistance > a.listDistance) ? -1 : 0);} );
    //console.log("("+z+"): "+cleanActive[0]+", "+cleanActive[1]+", "+cleanActive[2])
    console.log("("+z+"): "+activePilots[0].listNick+": "+activePilots[0].listDistance+", "+activePilots[1].listNick+": "+activePilots[1].listDistance+", "+activePilots[2].listNick+": "+activePilots[2].listDistance)
    toloop = [{listNick:"alex", listDistance:Math.floor((Math.random() * 20) + 1)},{listNick:"elen", listDistance:Math.floor((Math.random() * 20) + 1)},{listNick:"john", listDistance:Math.floor((Math.random() * 20) + 1)}]
}

*/




var fbEmail;
console.log("Updated fbUID: "+fbUID)
//Preloads data if they don't exist yet
var fbMeasurement = appSettings.getString("system", "imperial");
var fbName = appSettings.getString("name", "");
var fbNick = appSettings.getString("nick", "");
var fbPhoto = appSettings.getString("photo", "res://ic_photo");
var fbMain = appSettings.getString("mainColor", "#FF0000");
var fbSec = appSettings.getString("secColor", "#00FF00");
var fbIcon = appSettings.getString("icon", "mk_red_green");
fbUID = appSettings.getString("uid", "");
//console.log(L('FacebookLogin'));

//Updates airspaces database
//application.start({ moduleName: "geofire" });
//application.start({ moduleName: "firestore" });

//delete older entries
/*
firebase.remove("/airspaces/za");
firebase.setValue('/airspaces/za',
    {
      lastImport: '12/Mar/2018 12:56:53',
      version: '38a440188664d74eaf92dec6a1b85b96e53997f4'
    }
);
*/

if (fbUID!="") {
    console.log("Going direct to dashboard from app.js, with id: "+fbUID)
    //appSettings.setString("uid", fbUID);
    //fbUID = appSettings.getString("uid", fbUID);
    //application.start({ moduleName: "dash_live-page" });
    application.start({ moduleName: "flight-page" });
} else {
    application.start({ moduleName: "main-page" });
}



//application.start({ moduleName: "settings-page" });
//application.start({ moduleName: "dash_live-page" });

//application.start({ moduleName: "test" });


/*
Do not place any code after the application has been started as it will not
be executed on iOS.
*/
