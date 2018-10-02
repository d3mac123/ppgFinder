//DASH_LIVE
/* Renders all pilots in real time */
//require("nativescript-nodeify");

//Common libraries
var frames = require("ui/frame");
var dialogs = require("ui/dialogs");
var insomnia = require("nativescript-insomnia"); //keeps screen always on when flying)
var connectivity = require("tns-core-modules/connectivity");

var mapbox = require("nativescript-mapbox");
var map; //holds reference for map calls
var color = require("color");
var appSettings = require("application-settings");
var view = require("ui/core/view");

var observable = require("data/observable");
var observableArray = require("data/observable-array");
//var viewModel = new observable.Observable();

var pageModule = require("ui/page");

var FeedbackPlugin = require("nativescript-feedback");
var feedback = new FeedbackPlugin.Feedback();
var FeedbackType = require ("nativescript-feedback").FeedbackType;
var FeedbackPosition = require ("nativescript-feedback").FeedbackPosition;

var geolocation = require("nativescript-geolocation");
//console.log("STEP 0 ->"+geolocation.isEnabled())
var hasLocationEnabled = false;
if (!geolocation.isEnabled()) {
   geolocation.enableLocationRequest();
}

//2.6 Memory management test
/*
var lastPerformance = appSettings.getString("lastPerformance");
feedback.info({
    title: "Crash details",
    message: lastPerformance,
    duration: 10000
});
if (lastPerformance!="") {
    //Crashed last time
    alert(lastPerformance);
    console.log("*********************************LASTPERFORMANCE: "+ lastPerformance)
    //appSettings.setString("lastPerformance", "")
}


var perfMon = require("nativescript-performance-monitor");
var performanceMonitor = new perfMon.PerformanceMonitor(); 
performanceMonitor.start({
  textColor: new color.Color("white"),
  backgroundColor: new color.Color("black"),
  borderColor: new color.Color("black"),
  hide: true,
  onSample: function (sample) {
    console.log("FPS: " + sample.fps);
    if (sample.cpu) { // iOS only
      console.log("CPU %: " + sample.cpu);
      var mmm = "Crashed at FPS: "+sample.fps+" CPU%: "+sample.cpu;
      appSettings.setString("lastPerformance", mmm)
    }
  }
});
*/




//Application events 2.5.4
const application = require("application");
application.on(application.suspendEvent, (args) => {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        //console.log("SUSPEND UIApplication: " + args.ios);
        console.log("SUSPEND UIApplication: " + isFlying);
    }
});

application.on(application.resumeEvent, (args) => {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        //console.log("RESUME UIApplication: " + args.ios);
        console.log("RESUME UIApplication: " + isFlying);
        console.log("Origin: " + originLat+", "+originLon);
    }
});
/*
application.on(application.launchEvent, (args) => {
    if (args.android) {
        // For Android applications, args.android is an android.content.Intent class.
        console.log("Launched Android application with the following intent: " + args.android + ".");
    } else if (args.ios !== undefined) {
        // For iOS applications, args.ios is NSDictionary (launchOptions).
        console.log("Launched iOS application with options: " + args.ios);
    }
});

application.on(application.displayedEvent, (args) => {
    // args is of type ApplicaitonEventData
    console.log("displayedEvent");
});

application.on(application.orientationChangedEvent, (args) => {
    // args is of type OrientationChangedEventData
    console.log(args.newValue); // "portrait", "landscape", "unknown"
});


application.on(application.exitEvent, (args) => {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        console.log("**************** UIApplication: " + args.ios);
    }
});

application.on(application.lowMemoryEvent, (args) => {
    if (args.android) {
        // For Android applications, args.android is an android activity class.
        console.log("Activity: " + args.android);
    } else if (args.ios) {
        // For iOS applications, args.ios is UIApplication.
        console.log("UIApplication: " + args.ios);
    }
});

application.on(application.uncaughtErrorEvent, (args) => {
    console.log("Error: " + args.error);
});
*/




//Update images
//var imageSource = require("image-source")
//var image = require("ui/image");
var http = require("http");
var fs = require("file-system");
var BitmapFactory = require("nativescript-bitmap-factory");
var enums = require("ui/enums");


//2.2 Loading indicator
var LoadingIndicator = require("nativescript-loading-indicator").LoadingIndicator;
var loader = new LoadingIndicator();


var TextToSpeech = require("nativescript-texttospeech");
var TTS = new TextToSpeech.TNSTextToSpeech();


//Directions for Engine Out
var Directions = require("nativescript-directions").Directions;
var directions = new Directions();

//Tokens for Firebase Cloud Messaging
var firebase = require("nativescript-plugin-firebase");
const firebaseWebApi = require("nativescript-plugin-firebase/app");

//2.2 AIRSPACES
var closeAirspaces = [];
var hasAirspace = 0 //1 if country has airspace in the database
var air_lastImport = "";
var air_version = "";


//DEMO MODE
var demoMode = false

var folder = fs.knownFolders.documents();
console.log(fs.path.join(folder.path, ""));
const dbPath = fs.path.join(folder.path, "ppgfinder.db")
//console.log(dbPath)
//console.log("DB exists: "+fs.File.exists(dbPath))

//2.2 SQLite
var Sqlite = require( "nativescript-sqlite" );
//Sqlite.deleteDatabase("ppgfinder.db")
if (!Sqlite.exists("ppgfinder.db") && !fs.File.exists(dbPath)) {
    console.log("No SQL db yet. Copying SQLite database.")
    Sqlite.copyDatabase("ppgfinder.db");
} else {
    console.log("SQL db already exists.")
}
var db_name = "ppgfinder.db"
var db = null;
new Sqlite(db_name).then(dbConnection => {
    // next: create table for storing walks data
    db = dbConnection;
    console.log("Connected with DB.")
    console.log("DB==> "+db)
}, error => {
    console.log("NOT connected with DB.")
});



//API Google Geocoding Locations
var fetchModule = require("fetch");
const GOOGLE_GEOCODING_KEY = 'AIzaSyBO4kHMjCGus8oT_I_O5kP5lMPivaQsWxA'
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json?latlng='
var geoPlace
var originLocation


//Weather Underground - sample http://api.wunderground.com/api/20661ae8dffc9c30/conditions/q/CA/San_Francisco.json
const WU_KEY= '20661ae8dffc9c30';
//const WU_URL= 'httpS://api.wunderground.com/api/20661ae8dffc9c30/conditions/q/CA/San_Francisco.json'
var geoweather
var originWind
var originTemp
var originWeather
var originCity
var originCountry
var pastCity //used for comparison before download weather info


// Zeroes all variables
var originLoc; //saves the origin location
var originLat = 0; //26.058857; //saves the origin latitude
var originLon = 0; //-80.274303; //saves the origin longitude
var originHeading = "N";
var originAltitude
var originDistance = "0.0mi";
var originDistanceHolder
var originTime = "0 min";


var startRide //potentially used to calculate the ride time without a timer (which pauses when the app is in the background)

var mySpeed = 0 //current speed
var mySpeedHolder
var myDuration = "00:00" //ride time
var myDurationHolder
var myDistance = 0 //ride distance
var myDistanceHolder
var myAltitude = "0"; //current altitude
var myAltitudeHolder
var totActive = "";
var totActiveHolder
var myDirection; //current heading
var fbMi = "mi"; //miles for imperial, km for metric
var fbFt = "ft"; //ft for imperial, m for metric
var fbSp = "mph";
var compassHeading = 0 //controls the compass heading in the UI=
var maxSpeed = ""
var maxAltitude = 0

var previousLoc //used to calculate total distance
var previousHead = 0; //used to calculate direction of compass rotation
var curHead = 0;
var totalDistance = 0
var totalDistance2 = 0
var myAltitudeTag

var mySpeedTag
var fbIconHolder
var windDir = "N";
var headingDir = "S";
var windIcon
var headingIcon
var windButIcon

var myWindHolder
var myMaxSpeedHolder
var myHeadingHolder
var allowZoom = true;
var drawPlannedRoute = true;

//sets if is flying or on the ground
var isFlying = false

//To be used in the bottom bar
var dashIcon
var settingsIcon
var flightsIcon
var engineOutIcon
var backOriginIcon
var snapshotIcon
var deleteRoute
var showPathIcon
var speedIcon
var uploadRoute
var routeTagHolder
var routeDistHolder
var speedGraph
var altIcon
var altGraph
var durIcon
var distIcon
var originIcon
var routePlanning
var downloadRoute
var trackTracking
var trackPilotIcon
var trackPilotText
var trackDistIcon 
var trackDistanceHolder
var trackSpeedIcon
var trackHeadingHolder
var trackAltIcon
var trackAltHolder
var cameraStatusIcon

var closeAlert = true
var fbZoomLevel = appSettings.getString("zoomLevel", "13");

var fbUID = appSettings.getString("uid", "");
var fbIcon = appSettings.getString("icon", "mk_red_green");
var fbNick = appSettings.getString("nick", "");
var fbPhoto = appSettings.getString("photo", "res://ic_photo");
var fbMeasurement = appSettings.getString("system", "imperial");
var selectedMap = appSettings.getString("map", "Streets");
var fbAutoZoom = appSettings.getString("autoZoom", "on");
var fbColorBlind = appSettings.getString("colorBlind", "off");
var autoTrace = appSettings.getString("autoTrace", "off");
var fbCountry = appSettings.getString("country", "");

//2.6 Alerts OFF and bug fixings on crash
var showAltAlerts = appSettings.getString("showAltAlerts", "off");
var hasCrashed = false


//2.5 goPro Control
var fbCamera = appSettings.getString("camera", "");
var fbCameraMac = appSettings.getString("cameraMac", "");
var cameraOn = false
var cameraRecording = false
var cameraBattery
var cameraSDCard = false
var cameraSDSize
var cameraLCD
var cameraControl
//fbCamera=""
/*
var wol = require('wake_on_lan')
wol.wake('20:DE:20:DE:20:DE', function(error) {
    if (error) {
      // handle error
      console.log("WOL ERROR")
    } else {
      // done sending packets
      console.log("WOL SUCCESS")
    }
  });
*/

//2.1 Return to crashed flights
//appSettings.setString("lastFlight", "");
//appSettings.setString("lastFlight", "1516120702497");
var lastFlight = appSettings.getString("lastFlight", "");
var fID


var localPict = appSettings.getString("localPict", "no");
console.log("Has picture saved locally? "+localPict)
//localPict = "no";
//fbPhoto = "https://firebasestorage.googleapis.com/v0/b/ppg-finder.appspot.com/o/uploads%2F5v9FB2urEVcp9u4s6XdnqeZGt0n2%2Ftemp_photo.jpg?alt=media&token=008e9d66-a236-471b-a2c0-07cc84c53a21"

//voice alert
var voiceAlert = appSettings.getString("voiceAlert", "true");

//Tracking part
var trackedID = fbUID
var trackPilotIcon
var trackPilot
var trackDist

//2.4 buddies and snaps
var buddies = [] //holds all pilots that flew together


//keep database in sync
firebase.keepInSync(
    "/flights_temp/"+fbUID, // which path in your Firebase needs to be kept in sync?
    true      // set to false to disable this feature again
).then(
    function () {
      console.log("firebase.keepInSync is ON for /flights");
    },
    function (error) {
      console.log("firebase.keepInSync error: " + error);
    }
); 



//FUTURE USE - Draw routes
var myRoute = [];
var totalRoute = 0;
var previousRoute = 0;
var curSpeed = 0;

var showInRadius = 25; //shows only pilots in the radius of 20 miles
if (fbMeasurement === "imperial") {
    fbMi = "mi";
    fbFt = "ft";
    fbSp = "mph";
    showInRadius = 25;
} else {
    fbMi = "km";
    fbFt = "mt";
    fbSp = "kph";
    showInRadius = 40;
}

var isMe = "";
var repeatVoiceAlert = true

var page
//var pageData = new ObservableArray();


var activeUsers = []; //used for Map Markers
var thisFlight; //Holds the current flight path

//Used to send engine out alerts
var eoLat;
var eoLon;
var curLat;
var curLon;
var curLoc;

//Holds old values
var oldLocation;


var butStart
var butStop

var watchId
var pilotList
var compass

var activePilots = []; //used for the listView contents
var cleanActive = []
var alertGrid; //holds the color for the landing alert

var showPath = false;
if (autoTrace==="on") {
    showPath = true;
}



var drawer;
exports.pageLoaded = function(args) {
    page = args.object;
    //page.bindingContext = pageData;
    activePilots = new observableArray.ObservableArray();
    /*
    activePilots.push(
            {
                listNick: "SFC Soundsystem",
                listDist: "This is Happening"
            }
    );
    */
    //pageData.set("activeList", activePilots);
    drawer = view.getViewById(page, "sideDrawer");
    alertGrid = page.getViewById("alertGrid");
    
 
    pilotList = page.getViewById("pilotList");

    dashIcon = page.getViewById("dashIcon");
    settingsIcon = page.getViewById("settingsIcon");
    flightsIcon = page.getViewById("flightsIcon");
    backOriginIcon = page.getViewById("backOriginIcon");
    engineOutIcon = page.getViewById("engineOutIcon");
    //myLandAlertHolder = page.getViewById("myLandAlertHolder");
    
    deleteRoute = page.getViewById("deleteRoute");
    
 
    butStop = page.getViewById("butStop");


    //Track/Route Data
    routePlanning = page.getViewById("routePlanning");
    uploadRoute = page.getViewById("uploadRoute");
    downloadRoute = page.getViewById("downloadRoute");
    deleteRoute = page.getViewById("deleteRoute");
    routeTagHolder = page.getViewById("routeTagHolder");
    routeDistHolder = page.getViewById("routeDistHolder");
    butStart = page.getViewById("butStart");
    trackTracking = page.getViewById("trackTracking");
    trackPilotIcon = page.getViewById("trackPilotIcon");
    trackPilotText = page.getViewById("trackPilotText");
    trackDistIcon = page.getViewById("trackDistIcon");
    trackDistanceHolder = page.getViewById("trackDistanceHolder");
    trackSpeedIcon = page.getViewById("trackSpeedIcon");
    trackHeadingHolder = page.getViewById("trackHeadingHolder");
    trackAltIcon = page.getViewById("trackAltIcon");
    trackAltHolder = page.getViewById("trackAltHolder");
    

    //Flight Data
    speedIcon = page.getViewById("speedIcon");
    mySpeedHolder = page.getViewById("mySpeedHolder");
    myMaxSpeedHolder = page.getViewById("myMaxSpeedHolder");
    mySpeedTag = page.getViewById("mySpeedTag");
    speedGraph = page.getViewById("speedGraph");
    showPathIcon = page.getViewById("showPathIcon");
    altIcon = page.getViewById("altIcon");
    myAltitudeTag = page.getViewById("myAltitudeTag");
    myAltitudeHolder = page.getViewById("myAltitudeHolder");
    altGraph = page.getViewById("altGraph");
    durIcon = page.getViewById("durIcon");
    myDurationHolder = page.getViewById("myDurationHolder");
    distIcon = page.getViewById("distIcon");
    myDistanceHolder = page.getViewById("myDistanceHolder");
    windIcon = page.getViewById("windIcon");
    myWindHolder = page.getViewById("myWindHolder");
    originIcon = page.getViewById("originIcon");
    originDistanceHolder = page.getViewById("originDistanceHolder");
    headingIcon = page.getViewById("headingIcon");
    myHeadingHolder = page.getViewById("myHeadingHolder");
    totActiveHolder = page.getViewById("totActiveHolder");
    fbIconHolder = page.getViewById("fbIconHolder");
    windButIcon = page.getViewById("windButIcon");
    snapshotIcon = page.getViewById("snapshotIcon");
    attitudeIcon = page.getViewById("attitudeIcon");
    //cameraStatusIcon = page.getViewById("cameraStatus");
    cameraControl = page.getViewById("cameraControl");


    page.bindingContext = { activeList:activePilots, isMe: isMe, totActive: totActive, fbIcon: "res://"+fbIcon, mySpeedTag: fbSp.toUpperCase(), myMaxSpeed: maxSpeed, myHeading: headingDir, myWind: windDir, myAltitudeTag: fbFt, myAltitude: myAltitude, mySpeed: mySpeed, myDuration: myDuration, myDistance: myDistance, originHeading: originHeading, originDistance: originDistance, originTime: originTime};

    //Captures location when the app started
    //console.log("STEP 1 ->"+geolocation.isEnabled())
    if (!geolocation.isEnabled()) {
       geolocation.enableLocationRequest();
    }
/*
    myMaxSpeedHolder.animate({
        opacity: 0,
        duration: 1000
    })
*/
    //2.5.4 Used for RESUMING after leaving the app and returning
    if (isFlying && originLat!=0) {
        hideRouteTrack()
        showFlightData()
    } else {
        hideFlightData()
        showRouteTrack()

        //trackpilot
        trackPilotText.text = fbNick;
        trackPilotIcon.src = "res://"+fbIcon;
        routeTagHolder.text = fbMi;


        //Hides totActive and fbIconHolder
        backOriginIcon.style.marginTop = 5000;
        engineOutIcon.style.marginTop = 5000;
        snapshotIcon.style.marginTop = 5000;
        butStop.style.marginTop = 5000; 
    }
}

//Zeroes wind estimation
exports.onZeroWind = function() {
    maxSpeed = 0;
    console.log("Zeroing wind estimation")
};

//Message about returning to origin
exports.onBackOrigin = function() {
    feedback.info({
        title: L('msgBackTitle'),
        message: L('msgBack'),
        duration: 10000
    });

    //Save to Firebase
    firebase.setValue(
        'messages/'+fbUID,
        {
                msg: fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgBackShort'),
                uid: fbUID,
                nick: fbNick,
                type: "info",
                record: Date.now()                                                                
        }
    );

};

//Snapshot function
var snapNum = 0
exports.onSnapshot = function() {
    if (isFlying) {
        console.log("Em snapshot")

        if (fbCamera!="") {
            cameraSnapshot()
        }
    
        feedback.show({
            title: L('snapshot_title'),
            message: L('snapshot_msg'),
            duration: 10000,
            icon: "ic_camera",
            backgroundColor: new color.Color("#5ACC9F")
        });
    
        //Save to Firebase
        console.log("fbUID: "+fbUID+" - fid: "+fID)
    
        firebase.setValue(
            'flights/'+fbUID+'/'+fID+'/snapshots/'+snapNum,
            {
                    date: Date.now(),
                    lat: curLat,
                    lng: curLon
            }
        );
        snapNum = snapNum + 1
    
        /*
        //test buddies
        buddies = ["9LPnl4AyNkd7LpcOkyRn5zo2hL13","cDsQWUxi1WTyz3awoUWYrdkV5O22"]
        firebase.update(
            'flights/'+fbUID+'/'+fID+'/',
            {
                    'buddies': buddies
            }
        );
        */
    }

};

//Message about engine out
exports.onEngineOut = function() {
    feedback.warning({
        title: L('msgEngineOutTitle'),
        message: L('msgEngineOut'),
        duration: 10000
    });

    //Save to Firebase
    firebase.setValue(
        'messages/'+fbUID,
        {
                msg: fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgEngineOutShort')+curLat+", "+curLon,
                uid: fbUID,
                nick: fbNick,
                type: "warning",
                lat: curLat,
                lon: curLon,
                record: Date.now()                                
        }
    );

};

//Navigation to engine out places
function directionsToEO() {
    directions.navigate({
        to: {
            lat: eoLat,
            lng: eoLon
        }
    });
}


//check for MESSAGES
var readMessages = [];
setInterval(function() {
    var onQueryEvent = function(result) {
        if (!result.error) {     
            for(let uid in result.value){
                //delete entries older than 3hours (meaning they are dead ones)
                var oldtime = result.value[uid]["record"]
                var now = Date.now() 
                var timeLapse = (now-oldtime)/1000
                if (timeLapse>10800) {
                    //remove from Firebase
                    var activePath = 'messages/'+result.value[uid]["uid"];
                    var data = {};
                    data[activePath] = null;
                    firebase.update('/', data);
                } else {
                    //Do not print the own user       
                    if(result.value[uid]["uid"]!=fbUID && readMessages.indexOf(result.value[uid]["record"]) < 0 && parseInt(timeLapse)<60) {
                            if (result.value[uid]["type"]==="info") {
                                feedback.info({
                                    title: L('msgFrom')+" "+result.value[uid]["nick"].toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();}),
                                    message: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+L('msgSecAgo'),
                                    duration: 6000
                                });
                                var speakOptions = {
                                    text: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+L('msgSecAgo'),
                                    speakRate: 0.5,
                                    pitch: 1.0,
                                    volume: 1.0
                                };
                            } else if (result.value[uid]["type"]==="warning") {
                                feedback.warning({
                                    title: result.value[uid]["nick"].toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgEngineOutTitle'),
                                    message: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+" "+L('msgSecAgoLong'),
                                    duration: 10000,
                                    onTap: () => { eoLat = result.value[uid]["lat"]; eoLon = result.value[uid]["lon"]; console.log("showCustomIcon tapped"); directionsToEO() } //finish on tap
                                });
                                var speakOptions = {
                                    text: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+" "+L('msgSecAgoLong'),
                                    speakRate: 0.5,
                                    pitch: 1.0,
                                    volume: 1.0
                                };
                            } else {
                                feedback.success({
                                    title: L('msgFrom')+" "+result.value[uid]["nick"].toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();}),
                                    message: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+L('msgSecAgo'),
                                    duration: 6000
                                });
                                var speakOptions = {
                                    text: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+L('msgSecAgo'),
                                    speakRate: 0.5,
                                    pitch: 1.0,
                                    volume: 1.0
                                };
                            }
                            readMessages.push(result.value[uid]["record"]) //Engine Out
                            if (voiceAlert=="true") {
                                TTS.speak(speakOptions)
                            }                            
                            console.log("508")
                    }
                }

            }
        }; //end if onQuery
    } //end onQuery
    firebase.query(
        onQueryEvent,
        "/messages",
        {
            singleEvent: true,
            orderBy: {
                type: firebase.QueryOrderByType.CHILD,
                value: 'uid' 
            }
        }
    ); 

}, 15000); //60000 = 1 minute

//Controls autozoom
setInterval(function() {
 
    if (isFlying && fbAutoZoom==="on" && allowZoom) { 
     //console.log("Distancia para origin: "+Number(originDistance).toFixed(1))
        if ( (originDistance<.5 &&fbMi==="mi")|| (originDistance<.8 &&fbMi==="km") ){
            map.setZoomLevel(
                {
                    level: 14, // 14 is aprox. .5mi
                    animated: true // default true
                }
            )
        } else if ( (originDistance<2 &&fbMi==="mi")|| (originDistance<3.2 &&fbMi==="km") ){
           map.setZoomLevel(
                {
                    level: 11.5, // 11.5 - 2mi, 13.5 is aprox. 1mi
                    animated: true // default true
                }
            ) 
        } else {
           map.setZoomLevel(
                {
                    level: 13, // 13.5 is aprox. 1mi
                    animated: true // default true
                }
            ) 
        }
    }
}, 30000);

//updates interface while flying
setInterval(function() {
    //console.log("Location enabled 627: "+hasLocationEnabled)
    if (!hasLocationEnabled) {
        getOrigin()
    }
    if (!isFlying) { //only shows if not flying
        fbIcon = appSettings.getString("icon", "mk_red_green");
        if (String(fbIcon)!="undefined" && String(fbIconHolder)!="undefined") {
            fbIconHolder.src = "res://"+fbIcon
        }
        voiceAlert = appSettings.getString("voiceAlert")

        fbNick = appSettings.getString("nick");

        fbMeasurement = appSettings.getString("system", "imperial");
        if (fbMeasurement === "imperial") {
            fbMi = "mi";
            fbFt = "ft";
            fbSp = "mph";
        } else {
            fbMi = "km";
            fbFt = "mt";
            fbSp = "kph";
        }
 
        //myDistanceTag.text = fbMi;
        //myAltitudeTag.text = fbFt;
        //originDistanceHolder.text = "0.0"+fbMi;
        selectedMap = appSettings.getString("map", "Streets");
        fbAutoZoom = appSettings.getString("autoZoom", "on");
        fbColorBlind = appSettings.getString("colorBlind", "off");

        fbCamera = appSettings.getString("camera", "");
        if (fbCamera!=""){
           // getCameraSettings()
        }

        if (fbColorBlind==="on") {
           //originHeadingHolder.style.color = "#000000";
            //originTimeHolder.style.color = "#000000";
            //originDistanceHolder.style.color = "#000000";
        } else {
            //originHeadingHolder.style.color = "#FFFFFF";
           // originTimeHolder.style.color = "#FFFFFF";
           // originDistanceHolder.style.color = "#FFFFFF";
        }
    }
}, 5000);

//cleanView every 5 minutes
setInterval(function() {
    activePilots.length = 0;
    cleanActive = []
    if (!isFlying) { //only shows if flying
        trackDistanceHolder.text = "0"+fbMi
        trackHeadingHolder.text = "0"+fbSp
        trackAltHolder.text = "0"+fbFt
    }
}, 100000);

//controls the Drawer (showing active pilots)
exports.toggleDrawer = function() {
    //console.log("em toggleDrawer: "+totActive)
    if ((!isFlying && totActive>0) || (isFlying && totActive>1)) { //only shows if started
        drawer.toggleDrawerState();
    }
};

//Controls the map
function onMapReady(args) {
   map = args.map;
 
   //center map
    if (originLat===0) {
       originLat = 25.5014; //26.058587; //25.5014; //
       originLon = -80.5482; //-80.2764915; //-80.5482; //
    }

    args.map.setCenter({
      lat: originLat, // + 0.02600, //0.02174,
      lng: originLon,
      animated: true
    });
   
      
    if (page.android) {
        if (selectedMap==="Streets") {
            map.setMapStyle(mapbox.MapStyle.STREETS);
        } else if (selectedMap==="Light") {
            map.setMapStyle(mapbox.MapStyle.LIGHT);
        } else if (selectedMap==="Dark") {
            map.setMapStyle(mapbox.MapStyle.DARK);
        } else if (selectedMap==="Satellite") { 
            map.setMapStyle(mapbox.MapStyle.SATELLITE);
        } else if (selectedMap==="Hybrid") {
            map.setMapStyle(mapbox.MapStyle.HYBRID);
        } 

        args.map.setZoomLevel(
        {
            level: 13, // 13mandatory, 0-20
            animated: true // default true
        }
        )
    }

    //2.6 Wait before re-center map if user scroll it
    map.setOnScrollListener(function(point) {
        console.log("Map scrolled to latitude: " + point.lat + ", longitude: " + point.lng);
        if(isFlying && fbAutoZoom=="on"){
            //stop autozoom for 30s
            fbAutoZoom = "off"
            setTimeout(function() {
                fbAutoZoom = "on"
            }, 30000);
        }
      });
    
    
    //FUTURE USE - Route Planning
    map.setOnMapClickListener(function(point) {
        //SHOW AIRSPACE INFO
        if (closeAirspaces.length > 0) { 
            var closestAirspace = 0
            for (i=0; i<closeAirspaces.length; i++) {
                if (checkAirspace(point.lat,point.lng, closeAirspaces[i]["geometry"])) {
                    console.log("Dentro do airspace ("+closeAirspaces[i]["id"]+") "+closeAirspaces[i]["name"]+" max altitude: "+closeAirspaces[i]["altBotText"])
                    //if (closeAirspaces[i]["altBotText"]<airspaceMax) {
                        airspaceMax = closeAirspaces[i]["altBotText"]
                        airspaceMaxName = closeAirspaces[i]["name"]
                        airspaceMaxClass = closeAirspaces[i]["class"]
                        airspaceMin = closeAirspaces[i]["altTopText"]
                        airspaceFt = closeAirspaces[i]["altBotUnit"]
                        if (airspaceFt!="F") {
                            airspaceFt = "mt"
                            airspaceMax = (Number(airspaceMax)*0.3048).parseInt
                        } else {
                            airspaceFt = "ft"
                        }
                        var distKm = getDistanceFromLatLonInKm(closeAirspaces[i]["altLat"],closeAirspaces[i]["altLng"],curLat,curLon);
                        //console.log("Dentro do airspace ("+closeAirspaces[i]["id"]+") "+closeAirspaces[i]["name"]+" max altitude: "+closeAirspaces[i]["altBotText"]+" distancia: "+distKm)

                        if (airspaceMaxClass=="A" || airspaceMaxClass=="B" || airspaceMaxClass=="C" || airspaceMaxClass=="D") {
                            //msg = "CLASS "+ airspaceMaxClass +" airspace ("+airspaceMaxName+") requires permission to fly. "
                            msg = L('airspace_class')+" "+ airspaceMaxClass +" "+L('airspace')+airspaceMaxName+L('airspace_permission')
                            if (Number(airspaceMax)==0) {
                                msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt
                            } else {
                                msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt
                            }
                        } else if (airspaceMaxClass=="RESTRICTED" || airspaceMaxClass=="DANGER") {
                            if (airspaceMaxClass=="RESTRICTED") {
                                msg = L('airspace_restricted')+" "+L('airspace')+airspaceMaxName+L('airspace_avoid')
                            } else {
                                msg = L('airspace_danger')+" "+L('airspace')+airspaceMaxName+L('airspace_avoid')
                            }
                            msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt
                        }  else if (airspaceMaxClass=="PROHIBITED") {
                            msg = L('airspace_prohibited') +L('airspace')+airspaceMaxName+L('airspace_mustAvoid')
                            msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt
                        }  else if (airspaceMaxClass=="E") {
                            msg = L('airspace_class')+" "+ airspaceMaxClass +" "+L('airspace')+airspaceMaxName+L('airspace_safe')
                            msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt
                        } else {
                            msg = L('airspace_class')+" "+ airspaceMaxClass +" "+L('airspace')+airspaceMaxName+L('airspace_unknown')
                            msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt
                        }  
                        console.log(closestAirspace+" - "+distKm)  
                        if (closestAirspace == 0 || distKm <= closestAirspace) {
                            closestAirspace = distKm
                            console.log("chamando feedback.show")
                            feedback.show({
                                title: msg,
                                titleColor: new color.Color("#000000"),
                                position: FeedbackPosition.Top, // iOS only
                                type: FeedbackType.Custom, // this is the default type, by the way
                                message: msgTitle,
                                messageColor: new color.Color("#000000"),
                                duration: 10000,
                                backgroundColor: new color.Color("#FFB100"),
                                icon: "ic_dist_point"
                            });
                        }
                        
                    //} 
                                     
                } else {
                    feedback.hide();
                }
            }
        }
        console.log("clicou")
        if (!isFlying) {
            myRoute.push(point)

            //draw polyline
            map.removePolylines([2]);
            map.removeMarkers();
            map.addPolyline({
                    id: 2, // optional, can be used in 'removePolylines'
                    color: '#EE2A7B', // Set the color of the line (default black) - #30BCFF (blue)
                    width: 3.5, //Set the width of the line (default 5)
                    opacity: .8,
                    points: JSON.parse(JSON.stringify(myRoute))
            });
            if(myRoute.length<=1) {
                totalRoute = 0;
                previousRoute = point;
                mySpeedTag.text = fbSp.toUpperCase();
                mySpeedHolder.text = "0.0";
                feedback.hide();
            } else {
                //Geolocation issues made me find another way to do the calculations
                console.log("Dist between coordinates (getDistanceFromLatLonInKm): "+getDistanceFromLatLonInKm(previousRoute.lat,previousRoute.lng,point.lat,point.lng));
                var distKm = getDistanceFromLatLonInKm(previousRoute.lat,previousRoute.lng,point.lat,point.lng);

                if (fbMeasurement==="imperial") {
                    distKm = distKm * 0.621371;
                }
                totalRoute = totalRoute + distKm;
                previousRoute = point;

                console.log("Total Distance: "+ totalRoute.toFixed(1));
                routeTagHolder.text = fbMi;
                routeDistHolder.text = totalRoute.toFixed(1);

                //Draw waypoint markers
                for(z=0;z<=myRoute.length-1;z++) {
                    if (z!=0 && z!=myRoute.length-1) {
                        map.addMarkers([
                            {
                                id: Date.now(), // can be user in 'removeMarkers()'
                                lat: myRoute[z].lat, // mandatory
                                lng: myRoute[z].lng, // mandatory
                                icon: 'res://ic_route_waypoint'
                            }
                        ])
                    }
                }

            }
            map.addMarkers([
                {
                    id: "plan_origin", // can be user in 'removeMarkers()'
                    lat: myRoute[0].lat, // mandatory
                    lng: myRoute[0].lng, // mandatory
                    icon: 'res://ic_start_flight'
                }
            ])
            
            map.addMarkers([
                {
                    id: "plan_destination", // can be user in 'removeMarkers()'
                    lat: myRoute[myRoute.length-1].lat, // mandatory
                    lng: myRoute[myRoute.length-1].lng, // mandatory
                    icon: 'res://ic_end_flight'
                }
            ])
            
            
        } else {
            //user is flying
            allowZoom = false;
            //calculates distance
            var distKm = getDistanceFromLatLonInKm(point.lat,point.lng,curLat,curLon);
            map.removePolylines([5000]);
            map.removeMarkers([5000])
            map.addPolyline({
                id: 5000, // optional, can be used in 'removePolylines'
                color: '#FFB100', // Set the color of the line (default black) - #30BCFF (blue)
                width: 3.5, //Set the width of the line (default 5)
                opacity: .8,
                points: [
                {
                    'lat': curLat, // mandatory
                    'lng': curLon // mandatory
                },
                {
                    'lat': point.lat,
                    'lng': point.lng
                }]
            });
            map.addMarkers([
                {
                    id: 5000, // can be user in 'removeMarkers()'
                    lat: point.lat, // mandatory
                    lng: point.lng, // mandatory
                    icon: 'res://ic_route_waypoint'
                }
            ])
            
            var distSpeed
            if (fbMeasurement === "imperial") {
                distKm = distKm * 0.621371;
                distSpeed = parseInt(curSpeed / 0.447).toFixed(1);
            } else {
                distSpeed = parseInt(curSpeed * 3.6).toFixed(1);
            }
            var xyx = (distKm / distSpeed * 60)

            //setTimeout(function() {
                //falert.TNSFancyAlert.showSuccess(distKm.toFixed(2)+fbMi,xyx.toFixed(0) + " min", "OK", 15);
                feedback.show({
                    title: L('distPoint'),
                    titleColor: new color.Color("#000000"),
                    position: FeedbackPosition.Top, // iOS only
                    type: FeedbackType.Custom, // this is the default type, by the way
                    message: distKm.toFixed(2)+fbMi+" "+xyx.toFixed(0) + "min",
                    messageColor: new color.Color("#000000"),
                    duration: 10000,
                    backgroundColor: new color.Color("#FFB100"),
                    icon: "ic_dist_point"
                });
            //}, 500);
              
            //start timer 1 min to clean up the polyline (timeout)
            setTimeout(function() {
                allowZoom = true
                map.removePolylines([5000])
                map.removeMarkers([5000])
            }, 30000);
        }
    });
    
    var stimer = 3000
    if (page.android) {
        stimer = 7000
    }
    setTimeout(function() {
        //console.log("Redrawing the airspace")
        loadAirspaces();
        console.log("Starting startWatchId")
        startWatchId();
        console.log("Checking for camera presence..."+fbCamera)
        /*
        if (fbCamera==""){
            console.log("passou aqui")
            cameraStatusIcon.style.marginTop = 5000;
        }
        */
    }, stimer);
    
}
exports.onMapReady = onMapReady;


//Delete route plan
exports.onDeleteRoute = function(args) {
    if (totalRoute>0) { //only shows if flying
        totalRoute = 0;
        previousRoute = 0;
        myRoute = [];
        routeDistHolder.text = "0";
        map.removePolylines([2]);
        map.removeMarkers();
        feedback.hide();
    } else {
        alert(L('alertDeletedRoute'))
    }
}


//Function to calculate distances for the Route Plan feature
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}



//Callouts for the markers
var onTap = function(marker) {
    //alert("Marker tapped with title: '" + marker.title + "'");
};
exports.onTap = onTap;
var onCalloutTap = function(marker) {
  //alert("Marker callout tapped with title: '" + marker.title + "'");
};
exports.onCalloutTap = onCalloutTap;

//Saves the location when the app started
function getOrigin() {
    //console.log("Geolocation is enabled: "+geolocation.isEnabled())
    if (geolocation.isEnabled()) {
        var location = geolocation.getCurrentLocation({desiredAccuracy: 3, updateDistance: 0, minimumUpdateTime: 0})
        .then(function(loc) {
            if (loc) {
                originLoc = loc;
                originLat = loc.latitude;
                originLon = loc.longitude;
                originAltitude = loc.altitude;

                //set previousLoc if it does not exist yet
                previousLoc = loc;
        
                if (fbMeasurement === "imperial") {
                    fbMi = "mi";
                    fbFt = "ft";
                    fbSp = "mph";
                    myAltitude = parseInt(loc.altitude * 3.28084);
                    mySpeed = parseInt(loc.speed / 0.447);
                } else {
                    fbMi = "km";
                    fbFt = "mt";
                    fbSp = "kph";
                    mySpeed = parseInt(loc.speed * 3.6);
                    myAltitude = parseInt(loc.altitude);
                }
                myDirection = headingCompass(loc.direction)

                //myAltitudeHolder.text = parseInt(myAltitude).toFixed(0);
                //mySpeedHolder.text = parseInt(mySpeed).toFixed(0);
                //myDistanceHolder.text = "0.0"; // + fbMi; //myDistance.toFixed(1) + fbMi;

                map.setCenter({
                    lat: originLat, // + 0.02600, //0.02174,
                    lng: originLon,
                    animated: true
                });  
/*
                //Track map
                map.trackUser({
                    mode: "FOLLOW_WITH_HEADING", // "NONE" | "FOLLOW" | "FOLLOW_WITH_HEADING" | "FOLLOW_WITH_COURSE"
                    animated: true
                });
*/
                hasLocationEnabled = true;                
            }
        }, function(e){
            console.log("Line 947 (getOriginfunction) "+L('erroOrigin')+ " " + e.message);
            //alert(L('erroOrigin') + e.message); 
        });
    }
}
exports.getOrigin = getOrigin;



//Sets the right heading of the compass (if landscape, subtracts 90 degrees)
function headingCompass(args) {
    var compassHead = "";

    //gets orientation and set the compass head if landscape (subtracs 90 degrees)
    //console.log("Compass pointing to: "+compassHeading)
    args = args - compassHeading;
    if (args<0) {
        args = 360 + args;
    }
    if (args>12 && args<=34) {
        compassHead = L('NNE');
    } else if (args>34 && args<=57) {
        compassHead = L('NE');
    } else if (args>57 && args<=80) {
        compassHead = L('ENE');
    } else if (args>80 && args<=102) {
        compassHead = L('E');
    } else if (args>102 && args<=124) {
        compassHead = L('ESE');
    } else if (args>124 && args<=147) {
        compassHead = L('SE');
    } else if (args>147 && args<=170) {
        compassHead = L('SSE');
    } else if (args>170 && args<=192) {
        compassHead = L('S');
    } else if (args>192 && args<=215) {
        compassHead = L('SSW');
    } else if (args>215 && args<=237) {
        compassHead = L('SW');
    } else if (args>237 && args<=260) {
        compassHead = L('WSW');
    } else if (args>260 && args<=282) {
        compassHead = L('W');
    } else if (args>282 && args<=305) {
        compassHead = L('WNW');
    } else if (args>305 && args<=327) {
        compassHead = L('NW');
    } else if (args>327 && args<=350) {
        compassHead = L('NNW');
    } else {
        compassHead = L('N');
    }  

    return compassHead
}
exports.headingCompass = headingCompass;

//Calculates time of flight
function calcRidingTime(args) {
    var dt2 = new Date(Date.now());
    var dt1 = new Date(startRide);
    var diff =(dt2.getTime() - dt1.getTime()) / 1000;

    //solution from this site: https://www.sitepoint.com/community/t/how-do-i-change-time-format-from-minutes-to-hours-minutes-on-javascript/228701/2
    function twelveHourClock(seconds) {
        function leadingZero(num) {
            if (num < 10) {
                return "0";
            }
            return "";
        }
        var hours = parseInt(seconds / 3600);
        var minutes = parseInt((seconds - hours * 3600) / 60);
        var seconds = seconds % 60;
        return hours +
            ":" + leadingZero(minutes) + minutes;
    }
    myDurationHolder.text = twelveHourClock(diff)+'h';  
}


//Functions to calculate origin bearing
function radians(n) {
  return n * (Math.PI / 180);
}
function degrees(n) {
  return n * (180 / Math.PI);
}
function getBearing(startLat,startLong,endLat,endLong){
  startLat = radians(startLat);
  startLong = radians(startLong);
  endLat = radians(endLat);
  endLong = radians(endLong);

  var dLong = endLong - startLong;

  var dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
  if (Math.abs(dLong) > Math.PI){
    if (dLong > 0.0)
       dLong = -(2.0 * Math.PI - dLong);
    else
       dLong = (2.0 * Math.PI + dLong);
  }

  return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
}


//Update dashboard
function updateDash(args) {
    curSpeed = args.speed;
    curLat = args.latitude;
    curLon = args.longitude;
    curLoc = args

    if (isFlying) {
        map.setCenter(
            {
                lat: args.latitude,
                lng: args.longitude, // mandatory
                animated: true
            }
        )

        /*
        //Verify if there is camera activated and set the proper color
        //cameraOn = true //just for testing purposes
        //cameraRecording = true //just for testing purposes
        console.log("(1148) fbCamera: "+fbCamera+" cameraOn: "+cameraOn+" cameraRecording: "+cameraRecording)
        if (fbCamera!="") {
            if (cameraOn && !cameraRecording) {
                cameraStatusIcon.class="cameraStatusOFF"
                cameraStatusIcon.style.borderColor = "#B0D25A"; //green
            } else if (cameraRecording) {
                //cameraStatusIcon.class="cameraStatus"
                cameraStatusIcon.style.borderColor = "#E84343"; //red, flashing
                cameraStatusIcon.animate({
                    opacity: 0,
                    duration: 3000
                });
            } else {
                cameraStatusIcon.class="cameraStatusOFF"
                cameraStatusIcon.style.borderColor = 'lightslategray'; //"#FFFFFF"; //camera is off 
            }
        } else {
            cameraStatusIcon.style.borderColor = "#1F272A";
        }
        */
    }

    //Animates speed chart
    //console.log("speed: "+args.speed)
    var spc = "#696969"
    //args.speed = Math.floor(Math.random() * 35)
    if (args.speed >= 29) {
       speedGraph.src="res://ic_speed5"
       spc = "#E11C24"
    } else if (args.speed >= 23 && args.speed < 29) {
        speedGraph.src="res://ic_speed4"
        spc = "#F57426"
    } else if (args.speed >= 15 && args.speed < 23) {
        speedGraph.src="res://ic_speed3"
        spc = "#FFC400"
    } else if (args.speed >= 9 && args.speed < 15) {
        speedGraph.src="res://ic_speed2"
        spc = "#4BAC3B"
    } else if (args.speed >= 1 && args.speed < 9) {
        speedGraph.src="res://ic_speed1"
        spc = "#05A641"
    } else {
        speedGraph.src="res://ic_speed0"
        spc = "#696969"
    }

    //Animates altitude chart
    //console.log(args.altitude)
    //args.altitude = Math.floor(Math.random() * 1600)
    var groundAltitude = args.altitude - originAltitude
    if (groundAltitude < 0 ) {
        groundAltitude = groundAltitude * -1 //reverses altitude in the case took-off at 2000ft and is flying now at 1000ft - in this cenarion groundAltitude would be at -1000
    }
    if (groundAltitude >= 610) {
        altGraph.src="res://ic_alt5"
     } else if (groundAltitude >= 305 && groundAltitude < 610) { //610m = 2000ft
        altGraph.src="res://ic_alt4"
     } else if (groundAltitude >= 155 && groundAltitude < 305) { //305m = 1000ft
        altGraph.src="res://ic_alt3"
     } else if (groundAltitude >= 31 && groundAltitude < 155) { //155m = 508ft
        altGraph.src="res://ic_alt2"
     } else if (groundAltitude >= 10 && groundAltitude < 31) { //31m = 98ft
        altGraph.src="res://ic_alt1"
     } else {
        altGraph.src="res://ic_alt0"
     }

    //updates dash
    if (fbMeasurement === "imperial") {
        fbMi = "mi";
        fbFt = "ft";
        fbSp = "mph";
        myAltitude = parseInt(args.altitude * 3.28084);
        mySpeed = parseInt(args.speed / 0.447);
        showInRadius = 25;
    } else {
        fbMi = "km";
        fbFt = "mt";
        fbSp = "kph";
        mySpeed = parseInt(args.speed * 3.6);
        myAltitude = parseInt(args.altitude);
        showInRadius = 40;
    }
    myDirection = headingCompass(args.direction);

    myAltitudeHolder.text = parseInt(myAltitude).toFixed(0);
    curHead = args.direction;
    headingDir = headingCompass(curHead);
    myHeadingHolder.text = headingDir;

    //2.6 Reduce memory isses: only saves every 2 passes
    var mmm = new Date()
    //console.log(Date.now() + " - "+ mmm.getSeconds() + " - " + mmm.getSeconds()  % 2)

    if (isFlying && mmm.getSeconds()  % 2 === 0) {
            //****************************************
            //Things to do ONLY when flyig
            //updateTimer
            calcRidingTime()
            map.removeMarkers(activeUsers)

            activeUsers = [];

            //console.log("updating location: "+args.latitude+", "+args.longitude)
      
            //used for engine out messages
            curLat = args.latitude;
            curLon = args.longitude

            //Holds flight path
            var fixedSpeed
            if (args.speed<0) {
                fixedSpeed = 0
            } else {
                fixedSpeed = args.speed;
            }
            //console.log("thisFlight length: "+thisFlight.length)
            
            thisFlight.push({lat:args.latitude, lng:args.longitude, altitude:args.altitude, speed:fixedSpeed, date:Date.now()})

            //Draw (or not) the route path
            if ( showPath ) { 
                //Draw polylines
                map.removePolylines([1]);
                map.addPolyline({
                    id: 1, // optional, can be used in 'removePolylines'
                    color: '#30BCFF', // Set the color of the line (default black)
                    width: 5, //Set the width of the line (default 5)
                    points: JSON.parse(JSON.stringify(thisFlight))
                });
            } 

            //Draw planned route path
            if(drawPlannedRoute && myRoute.length>1) {
                //console.log("myRoute.length: "+myRoute.length)
                map.removePolylines([2]);
                map.addPolyline({
                        id: 2, // optional, can be used in 'removePolylines'
                        color: '#EE2A7B', // Set the color of the line (default black) - #30BCFF (blue)
                        width: 3.5, //Set the width of the line (default 5)
                        opacity: .8,
                        points: JSON.parse(JSON.stringify(myRoute))
                });
                drawPlannedRoute = false;
            }            

            totalDistance = totalDistance + getDistanceFromLatLonInKm(previousLoc.latitude,previousLoc.longitude,args.latitude,args.longitude) * 1000;
            previousLoc = args;

            //2.2 Update distance locally
            if (db!=null) {
                db.execSQL('UPDATE flight SET distance = ?, data = ? WHERE fid = ?', [totalDistance, JSON.stringify(thisFlight), fID], function(err, id) {
                    //console.log("Updated distances in SQLite");
                }, error => {
                    console.log("INSERT ERROR", err);
                })
            }

            //originDistance = getDistanceFromLatLonInKm(originLoc.latitude,originLoc.longitude,args.latitude,args.longitude) * 1000;
            //2.1 Recalculate origin distance
            originDistance = getDistanceFromLatLonInKm(originLat,originLon,args.latitude,args.longitude) * 1000;
            //console.log("Calculating distance to origin: "+originLat+", "+originLon)
            //console.log("Calculating distance to originLoc: "+originLoc.latitude+", "+originLoc.longitude)
  
            //updates dash
            if (fbMeasurement === "imperial") {
                myDistance = Number(totalDistance * 0.000621371);
                originDistance = Number(originDistance * 0.000621371);
            } else {
                myDistance = Number(totalDistance/1000);
                originDistance = Number(originDistance/1000);
            }

            myDistanceHolder.text = myDistance.toFixed(1) + fbMi;
            mySpeedHolder.text = mySpeed

            //Panic part     
            //originHeadingHolder.text = headingCompass(getBearing(args.latitude,args.longitude,originLat,originLon));
            var xx = (originDistance / mySpeed * 60)
            originDistanceHolder.text = headingCompass(getBearing(args.latitude,args.longitude,originLat,originLon))+"   "+Number(originDistance).toFixed(1) + fbMi+"   "+xx.toFixed(0) + "min"
            
            //Check for Max Speed and Max Altitude
            if (mySpeed > maxSpeed) {
                maxSpeed = mySpeed;
                /* FIND THE RIGHT WAY TO INVERT THE VALUE OF CURHEAD. EX. IF IT SAYS NORTH, WIND IS COMING FROM SOUTH */
                windDir = headingCompass(curHead);
                if (windDir===L('N')) {
                    windDir = L('S');
                } else if (windDir===L('NNE')) {
                    windDir = L('SSW');
                } else if (windDir===L('NE')) {
                    windDir = L('SW');
                } else if (windDir===L('ENE')) {
                    windDir = L('WSW');
                } else if (windDir===L('E')) {
                    windDir = L('W');
                } else if (windDir===L('ESE')) {
                    windDir = L('WNW');
                } else if (windDir===L('SE')) {
                    windDir = L('NW');
                } else if (windDir===L('SSE')) {
                    windDir = L('NNW');
                } else if (windDir===L('S')) {
                    windDir = L('N');
                } else if (windDir===L('SSW')) {
                    windDir = L('NNE');
                } else if (windDir===L('SW')) {
                    windDir = L('NE');
                } else if (windDir===L('WSW')) {
                    windDir = L('ENE');
                } else if (windDir===L('W')) {
                    windDir = L('E');
                } else if (windDir===L('WNW')) {
                    windDir = L('ESE');
                } else if (windDir===L('NW')) {
                    windDir = L('SE');
                } else if (windDir===L('NNW')) {
                    windDir = L('SSE');
                }
                myWindHolder.text = windDir

                myMaxSpeedHolder.text = parseInt(maxSpeed);
                //2.6 Backp maxSpeed and buddies list
                appSettings.setString("bkp_maxSpeed", "maxSpeed");
                /*
                if (buddies!=undefined) { 
                    console.log("buddies undefined")
                    buddies = appSettings.setString("bkp_buddies", JSON.stringify(buddies));
                } else {
                    console.log("buddies defined")
                    buddies = [] 
                }
                */
                
                //set color based on speed scale
                myMaxSpeedHolder.style.color = "#FFC400"; //spc;
                
                //myMaxSpeedHolder.animate({scale:{ x: 5, y: 5}, duration:500})
                myMaxSpeedHolder.animate({
                    opacity: 1,
                    duration: 3000
                })
            }
            myWindHolder.text = windDir

            if (myAltitude > maxAltitude) {
                maxAltitude = myAltitude;
            }   

            //Landing alert
            var landingAlert = 25; //meters
            if (fbMeasurement === "imperial") {
                landingAlert = 82; //feet
            }

            //console.log(myWindHolder.text+"-"+myHeadingHolder.text)
            alertGrid.style.backgroundColor = "#30BCFF";
            if (myAltitude > 3) {
                if ( ((myAltitude-originAltitude) < landingAlert) && (args.speed > 0) ) {
                    if (myWindHolder.text===myHeadingHolder.text) {
                        //GREAT! Heading into the wind!;
                        alertGrid.style.backgroundColor = "#05A641";
                    } else if (myWindHolder.text.substr(0, 1)===myHeadingHolder.text.substr(0, 1) && showAltAlerts=="on") {  //a.substr (0, 1)
                        //ALMOST THERE! May have a cross wind!
                        alertGrid.style.backgroundColor = "#FFC400";
                        feedback.info({
                            title: "Attention", //"Message from "+result.value[uid]["nick"],
                            message: L('attentionCrossWind'), 
                            icon: "ic_engine_out",
                            backgroundColor: new color.Color("#FFC400"),
                            messageColor: new color.Color("#000000"),
                            titleColor: new color.Color("#000000"),
                            duration: 10000
                        });
                        var speakOptions = {
                            text: L('attentionCrossWind'),
                            speakRate: 0.5,
                            pitch: 1.0,
                            volume: 1.0
                        };
                        if (repeatVoiceAlert && closeAlert && voiceAlert=="true") {
                            TTS.speak(speakOptions) //cross wind
                            console.log("1220")
                        }
                        repeatVoiceAlert = false //do not allow to keep repeating the voice alert
                        closeAlert = false
                        setTimeout(function() {
                            repeatVoiceAlert = true
                            closeAlert = true
                        }, 20000);
                    } else if (showAltAlerts=="on") {
                        //NO! NO! 
                        alertGrid.style.backgroundColor = "#FF1D1D";
                        feedback.info({
                            title: "Attention", //"Message from "+result.value[uid]["nick"],
                            message: L('attentionTailWind'), 
                            icon: "ic_engine_out",
                            backgroundColor: new color.Color("#FF1D1D"),
                            duration: 10000
                        });
                        var speakOptions = {
                            text: L('attentionTailWind'),
                            speakRate: 0.5,
                            pitch: 1.0,
                            volume: 1.0
                        };
                        if (repeatVoiceAlert && closeAlert && voiceAlert=="true") {
                            TTS.speak(speakOptions) //tail wind
                            console.log("1239")
                        }
                        repeatVoiceAlert = false //do not allow to keep repeating the voice alert
                        closeAlert = false
                        setTimeout(function() {
                            repeatVoiceAlert = true
                        }, 20000); 
                    }
                }
            } 
            firebase.setValue(
                'active/'+fbUID,
                {
                        nick: fbNick,
                        icon: fbIcon,
                        speed: args.speed,
                        altitude: args.altitude,
                        direction: args.direction,
                        photo: fbPhoto,
                        location: { 
                            latitude: args.latitude,
                            longitude: args.longitude
                        },
                        uid: fbUID,
                        record: Date.now()                                
                }
            );          
            
          //DRAWER OF ACTIVE PILOTS
            var onQueryEvent = function(result) {
                    if (!result.error) { 
                        //console.log(JSON.stringify(result))     
                        var firebaseTotal = 0;        
                        for(let uid in result.value){
                            //delete entries older than 5min (meaning they are dead ones)
                            var oldtime = result.value[uid]["record"]
                            var now = Date.now() 
                            var timeLapse = (now-oldtime)/1000
                            if (timeLapse>300) {
                                //remove from Firebase
                                var activePath = 'active/'+result.value[uid]["uid"];
                                var data = {};
                                data[activePath] = null;
                                firebase.update('/', data);
                            } else {
                                //console.log("comparing fbNick "+fbNick+" with "+result.value[uid]["nick"])          
                                //if(result.value[uid]["nick"]!=fbNick) {
                                if (result.value[uid]["nick"].substr(0,6) != "(Demo)") {
                                    var dbLoc = result.value[uid]["location"];          
                                    //var xd = geolocation.distance(dbLoc, args);  
                                    var xd = getDistanceFromLatLonInKm(dbLoc.latitude,dbLoc.longitude,args.latitude,args.longitude) * 1000
                                    var xdClose = xd/1000
                                    //console.log("*** XD: "+xd+" metric: "+(xd/1000)+" imperial: "+(xd*0.000621371))
                                    if (fbMeasurement==="imperial") {
                                        xd = Number(xd * 0.000621371); //converts meters to mi
                                    } else {
                                        xd = Number(xd / 1000); //converts meters to km
                                    }     
                                

                                    //console.log("$$$$$$$ "+showInRadius+", xd: "+xd)
                                    if (xd<showInRadius) {
                                        //adds to activeUsers table and create markers if they havent one yet
                                        activeUsers.push(result.value[uid]["uid"]) 
                                        firebaseTotal = firebaseTotal + 1;

                                        var usePhoto = result.value[uid]["photo"];

                                        var xalt
                                        var xspeed
                                        var xm = L('feet')
                                        if (fbMeasurement==="imperial") {
                                            xalt = parseInt(result.value[uid]["altitude"] * 3.28084);
                                            xspeed = parseInt(result.value[uid]["speed"] / 0.447);
                                            xm = L('feet')
                                        } else {
                                            xalt = result.value[uid]["altitude"];
                                            xspeed = parseInt(result.value[uid]["speed"] * 3.6);
                                            xm = L('meters')
                                        } 
                                        //FLIGHT VIEW
                                        if(result.value[uid]["nick"]!=fbNick) {
                                            var myIcon = 'res://'+result.value[uid]["icon"]
                                            //console.log("Icone original: "+myIcon)
                                            //console.log("Icone modificado: "+result.value[uid]["uid"].substr(0,5).toLowerCase())
                                            if (result.value[uid]["uid"].substr(0,5).toLowerCase() === "5v9fb") { //alex
                                            // myIcon = 'res://mk_'+result.value[uid]["uid"].substr(0,5).toLowerCase()
                                            }
                                            map.addMarkers([
                                                {
                                                    id: result.value[uid]["uid"],
                                                    lat: result.value[uid]["location"]["latitude"], // mandatory
                                                    lng: result.value[uid]["location"]["longitude"], // mandatory
                                                    title: result.value[uid]["nick"]+" "+L('speed')+": "+parseInt(xspeed), // no popup unless set
                                                    subtitle: L('altitude')+": "+parseInt(xalt)+"\r\n"+L('heading')+": "+headingCompass(result.value[uid]["direction"])+"\r\n"+L('distance')+": "+xd.toFixed(1),
                                                    icon: myIcon, // preferred way, otherwise use:
                                                //   icon: 'https://scontent.xx.fbcdn.net/v/t1.0-1/s100x100/1472851_10152060644647922_1668472124_n.jpg?oh=adaf8371a460d6fc342f0744692e20fa&oe=59BC3A44', // from the internet (see the note at the bottom of this readme), or:
                                                // iconPath: 'res/markers/home_marker.png',
                                                    onTap: onTap,
                                                    onCalloutTap: onCalloutTap
                                                }
                                            ])
                                            isMe = "";

                                            //2.1.x save local picture IF it is already compacted and does not exist locally
                                            //console.log("Tem "+result.value[uid]["uid"]+".jpg? "+usePhoto.indexOf(result.value[uid]["uid"]+".jpg"))
                                            var path_td = fs.path.join(folder.path, result.value[uid]["uid"]+".jpg");
                                            var ftd = result.value[uid]["photo"];
                                            if (usePhoto!="res://ic_photo" && usePhoto.indexOf(result.value[uid]["uid"]+".jpg")>0 && !fs.File.exists(path_td)) {
                                                //console.log("Salva imagem local!")
                                                
                                                //console.log("Userid: "+result.value[uid]["uid"])
                                                //console.log("usePhoto: "+usePhoto)
                                                http.getImage(ftd).then((r) => {
                                                    //console.log("Salvando foto: "+ftd)
                                                    //console.log("em: "+path_td)
                                                    r.saveToFile(path_td,"jpeg")
                                                    usePhoto = path_td;
                                                }, (err) => {
                                                    // Argument (e) is Error!
                                                    //console.log(e);
                                                    console.log("Error loading user image! "+e)
                                                });
                                            } else if (fs.File.exists(path_td)) {
                                                usePhoto = path_td;
                                            }
                                        } else {
                                            isMe = "("+L('me')+") ";
                                            var path = fs.path.join(folder.path, fbUID+".jpg");
                                            //console.log("Local photo: "+path)
                                            usePhoto = path;
                                        }  

                                        var d = new Date();
                                        var e = formatDate(d);
                                        //Add items into the listView
                                        var index = cleanActive.indexOf(result.value[uid]["uid"]);
                                        var indActive = activePilots.indexOf(result.value[uid]["uid"]);

                                        //Calculates bearing from ME
                                        var distBearing = headingCompass(getBearing(args.latitude,args.longitude,result.value[uid]["location"]["latitude"],result.value[uid]["location"]["longitude"]));  
                                       // console.log("Dist :"+xd.toFixed(1)+" bearing from "+result.value[uid]["nick"]+": "+distBearing)   

                                       //resize ListNick size is length is longer than 10 digits
                                       var anick = result.value[uid]["nick"]
                                       if (anick.length>10) {
                                            anick = result.value[uid]["nick"].substr(0,9)+"..."
                                       }
                                        if (index === -1) {     
                                            //Adds into the listView
                                            cleanActive.push(result.value[uid]["uid"]);       
                                            activePilots.push(
                                                {   listMiles:fbMi+" ", 
                                                    distHeading: " "+distBearing,
                                                    listKey:result.value[uid]["uid"], 
                                                    listHeading:headingCompass(result.value[uid]["direction"]), 
                                                    listDistance:xd.toFixed(1),
                                                    listIcon:'res://'+result.value[uid]["icon"], 
                                                    listAltitude:parseInt(xalt)+fbFt,
                                                    listNick: anick, 
                                                    listPhoto: usePhoto,
                                                    isMe:isMe,
                                                    listSpeed:parseInt(xspeed)+fbSp,
                                                    pLoc:dbLoc
                                                 })

                                        } else {
             
                                            //updates ListView
                                            activePilots.splice(index,1,
                                            {   listMiles:fbMi+" ",
                                                distHeading: " "+distBearing, 
                                                listKey:result.value[uid]["uid"], 
                                                listHeading:headingCompass(result.value[uid]["direction"]), 
                                                listDistance:xd.toFixed(1),
                                                listIcon:'res://'+result.value[uid]["icon"], 
                                                listAltitude:parseInt(xalt)+fbFt,
                                                listNick: anick, 
                                                listPhoto: usePhoto,
                                                isMe:isMe,
                                                listSpeed:parseInt(xspeed)+fbSp,
                                                pLoc:dbLoc 
                                            })
                                        }
                                        //console.log(JSON.stringify(cleanActive)) 
                                        //console.log("Line 1496) FirebaseTotal: "+firebaseTotal)
                                        totActive = firebaseTotal; //cleanActive.length;
                                        //console.log("Line 1497) TotActive: "+totActive)
                                        totActiveHolder.text = totActive - 1;

                                        //2.4 Holds lists of "buddies" flying closer than 1 mile
                                        if (buddies==undefined){
                                            console.log("buddy is undefined")
                                            buddies = [];
                                        }
                                        console.log("$$$$$$ buddie : "+result.value[uid]["uid"])
                                        if(xd<1 && isMe === "" && buddies!=undefined) { 
                                            console.log("$$$$$$ Has buddies: "+buddies.indexOf(result.value[uid]["uid"] ) )
                                            var checkBuddies = buddies.indexOf(result.value[uid]["uid"]);
                                            if (checkBuddies === -1) { 
                                                buddies.push(result.value[uid]["uid"])
                                            } else {
                                                buddies.splice(checkBuddies,1,result.value[uid]["uid"])
                                            }
                                        }
                                        //console.log("Buddies lenght: "+buddies.length)

                                        //sends voice message if pilot is too close
                                        if(xdClose<0.05 && isMe === "" && repeatVoiceAlert) { //50meters
                                            var upDown
                                            var leftRight
                                            var inMeters
                                            //console.log(parseInt(xalt)+"<->"+myAltitude)
                                            //console.log(distBearing+"<->"+myHeadingHolder.text)
                                            //console.log(distBearing.substring(0,1)+"<->"+myHeadingHolder.text.substring(0,1))
                                            if (xm===L('meters')) {
                                                inMeters = xdClose * 1000
                                            } else {
                                                inMeters = xdClose * 3280
                                            }
                                            if (parseInt(xalt) >= myAltitude) {
                                                upDown = L('above')
                                            } else {
                                                upDown = L('below')
                                            }
                                            if (myHeadingHolder.text.substring(0,1)===L('N') && distBearing.substring(0,1)===L('W')) {
                                                leftRight = L('left')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('N') && distBearing.substring(0,1)===L('E')) {
                                                leftRight = L('right')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('N') && distBearing.substring(0,1)===L('S')) {
                                                leftRight = L('behind')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('N') && distBearing.substring(0,1)===L('N')) {
                                                leftRight = L('front')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('S') && distBearing.substring(0,1)===L('E')) {
                                                leftRight = L('left')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('S') && distBearing.substring(0,1)===L('W')) {
                                                leftRight = L('right')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('S') && distBearing.substring(0,1)===L('N')) {
                                                leftRight = L('behind')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('S') && distBearing.substring(0,1)===L('S')) {
                                                leftRight = L('front')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('E') && distBearing.substring(0,1)===L('N')) {
                                                leftRight = L('left')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('E') && distBearing.substring(0,1)===L('S')) {
                                                leftRight = L('right')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('E') && distBearing.substring(0,1)===L('W')) {
                                                leftRight = L('behind')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('E') && distBearing.substring(0,1)===L('E')) {
                                                leftRight = L('front')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('W') && distBearing.substring(0,1)===L('S')) {
                                                leftRight = L('left')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('W') && distBearing.substring(0,1)===L('N')) {
                                                leftRight = L('right')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('W') && distBearing.substring(0,1)===L('E')) {
                                                leftRight = L('behind')
                                            } else if (myHeadingHolder.text.substring(0,1)===L('W') && distBearing.substring(0,1)===L('W')) {
                                                leftRight = L('front')
                                            }
                                            if(page.ios) {
                                                var speakOptions = {
                                                    text: anick+" "+L('msgFlyingClose',parseInt(inMeters)+xm, upDown, leftRight),
                                                    speakRate: 0.5,
                                                    pitch: 1.0,
                                                    volume: 1.0
                                                };
                                            } else {
                                                var speakOptions = {
                                                    text: anick+" "+L('msgFlyingClose',parseInt(inMeters)+xm, upDown, leftRight),
                                                    speakRate: 1.0,
                                                    pitch: 1.0,
                                                    volume: 1.0
                                                };
                                            }
                                            if (myAltitude > 10 && repeatVoiceAlert && closeAlert && voiceAlert=="true") {
                                                TTS.speak(speakOptions) //flying close
                                            
                                                console.log("1466 - myAltitude: "+myAltitude+" startAltitude: "+originAltitude)
                                                map.setZoomLevel(
                                                {
                                                    level: 18, // mandatory, 0-20
                                                    animated: true // default true
                                                })
                                                repeatVoiceAlert = false //do not allow to keep repeating the voice alert
                                                closeAlert = false
                                                setTimeout(function() {
                                                    repeatVoiceAlert = true
                                                    closeAlert = true
                                                }, 15000); 
                                                feedback.warning({
                                                    message: anick+" "+L('msgFlyingClose',parseInt(inMeters)+xm, upDown, leftRight),
                                                    duration: 5000,
                                                });
                                            }
                                        }

                                        //console.log("fbNick: "+fbNick+" listView name: "+result.value[uid]["nick"].replace(/(([^\s]+\s\s*){1})(.*)/,"$1…"))
                                        //Sorts the data by DISTANCE
                                        //activePilots.sort(function(a,b) {return (a.listDistance > b.listDistance) ? 1 : ((b.listDistance > a.listDistance) ? -1 : 0);} );
                                        //activePilots.sort(function(a,b) {return (a.listNick > b.listNick) ? 1 : ((b.listNick > a.listNick) ? -1 : 0);} );
                                    }
                                } //ends IF the user is a demo user
                            }
 
                        } //end for
                        //Sorts the data by DISTANCE
                        activePilots.sort(function(a,b) {return (a.listDistance > b.listDistance) ? 1 : ((b.listDistance > a.listDistance) ? -1 : 0);} );

                    }; //end if onQuery
            } //end onQuery
            firebase.query(
                onQueryEvent,
                "/active",
                {
                    // set this to true if you want to check if the value exists or just want the event to fire once
                    // default false, so it listens continuously.
                    // Only when true, this function will return the data in the promise as well!
                    singleEvent: true,
                    // order by company.country
                    orderBy: {
                        type: firebase.QueryOrderByType.CHILD,
                        value: 'nick' // uid -->mandatory when type is 'child'
                    }
                }
            );     
    } //closes update only when flying       
}
exports.updateDash = updateDash;

//Go to flights screen
exports.showFlights = function(args){
    //delete previous routes
    myRoute.length = 0;
    myRoute = [];
    previousRoute = 0;
    map.destroy();
    if (watchId) {
        console.log("Finishing watchID")
        geolocation.clearWatch(watchId);
    }
    if (!isFlying) {
        var navigationEntry = {
            moduleName: "flights-page",
            animated: true,
            transition: {
                name: "slideLeft",
                duration: 380,
                curve: "easeIn", clearHistory: true
            }
        };
        frames.topmost().navigate(navigationEntry);
        //frames.topmost().navigate({ moduleName: "settings-page", clearHistory: true });    
    }
}

//Go to settings screen
exports.showSettings = function(args){
    if (!isFlying) {
        //frames.topmost().navigate("settings-page"); 
        //delete previous routes
        myRoute.length = 0;
        myRoute = [];
        previousRoute = 0;
        map.destroy();
        if (watchId) {
            console.log("Finishing watchID")
            geolocation.clearWatch(watchId);
        }
        var navigationEntry = {
            moduleName: "settings-page",
            clearHistory: true,
            animated: true,
            transition: {
                name: "slideTop",
                duration: 380,
                curve: "easeIn"
            }
        };
        frames.topmost().navigate(navigationEntry);
        //frames.topmost().navigate({ moduleName: "settings-page", clearHistory: true });    
    }
}

//hide route and track elements
function hideRouteTrack() {
    routePlanning.style.marginTop = 5000;
    uploadRoute.style.marginTop = 5000;
    downloadRoute.style.marginTop = 5000;
    deleteRoute.style.marginTop = 5000;
    routeTagHolder.style.marginTop = 5000;
    routeDistHolder.style.marginTop = 5000;
    butStart.style.marginTop = 5000;
    trackTracking.style.marginBottom = 5000;
    trackPilotIcon.style.marginTop = 5000;
    trackPilotText.style.marginTop = 5000;
    trackDistIcon.style.marginTop = 5000;
    trackDistanceHolder.style.marginTop = 5000;
    trackSpeedIcon.style.marginTop = 5000;
    trackHeadingHolder.style.marginTop = 5000;
    trackAltIcon.style.marginTop = 5000;
    trackAltHolder.style.marginTop = 5000;
}
exports.hideRouteTrack

//show route and track elements
function showRouteTrack() {
    routePlanning.style.marginTop = -30;
    uploadRoute.style.marginTop = 10;
    downloadRoute.style.marginTop = 10;
    deleteRoute.style.marginTop = 10;
    routeTagHolder.style.marginTop = 10;
    routeDistHolder.style.marginTop = 10;
    butStart.style.marginTop = 10;
    trackTracking.style.marginBottom = -20;
    trackPilotIcon.style.marginTop = 10;
    trackPilotText.style.marginTop = 10;
    trackDistIcon.style.marginTop = 0;
    trackDistanceHolder.style.marginTop = 0;
    trackSpeedIcon.style.marginTop = 0;
    trackHeadingHolder.style.marginTop = 0;
    trackAltIcon.style.marginTop = 0;
    trackAltHolder.style.marginTop = 0;
}
exports.showRouteTrack

//hide flight data
function hideFlightData() {
    speedIcon.style.marginTop = 5000;
    mySpeedHolder.style.marginTop = 5000;
    myMaxSpeedHolder.style.marginTop = 5000;
    mySpeedTag.style.marginTop = 5000;
    speedGraph.style.marginTop = 5000;
    showPathIcon.style.marginTop = 5000;
    altIcon.style.marginTop = 5000;
    myAltitudeTag.style.marginTop = 5000;
    myAltitudeHolder.style.marginTop = 5000;
    altGraph.style.marginTop = 5000;
    durIcon.style.marginBottom = 5000;
    myDurationHolder.style.marginBottom = 5000;
    distIcon.style.marginBottom = 5000;
    myDistanceHolder.style.marginBottom = 5000;
    windIcon.style.marginBottom = 5000;
    myWindHolder.style.marginBottom = 5000;
    originIcon.style.marginBottom = 5000;
    originDistanceHolder.style.marginBottom = 5000;
    headingIcon.style.marginBottom = 5000;
    myHeadingHolder.style.marginBottom = 5000;
    alertGrid.style.backgroundColor = "#3AB8FF"
    windButIcon.style.marginBottom = 5000;
    //cameraStatusIcon.style.marginBottom = 5000;
    //cameraStatusIcon.style.borderColor = "#1F272A";
}
exports.hideFlightData

//show flight data
function showFlightData() {
    speedIcon.style.marginTop = -30;
    mySpeedHolder.style.marginTop = -5;
    myMaxSpeedHolder.style.marginTop = -20;
    mySpeedTag.style.marginTop = 10;
    speedGraph.style.marginTop = 55;
    showPathIcon.style.marginTop = 0;
    altIcon.style.marginTop = -30;
    myAltitudeTag.style.marginTop = 5;
    myAltitudeHolder.style.marginTop = -5;
    altGraph.style.marginTop = -5;
    durIcon.style.marginBottom = -10;
    myDurationHolder.style.marginBottom = -10;
    distIcon.style.marginBottom = -10;
    myDistanceHolder.style.marginBottom = -10;
    windIcon.style.marginBottom = -10;
    myWindHolder.style.marginBottom = -10;
    originIcon.style.marginBottom = 0;
    originDistanceHolder.style.marginBottom = 0;
    headingIcon.style.marginBottom = 0;
    myHeadingHolder.style.marginBottom = 0;
    windButIcon.style.marginBottom = 0;
    //cameraStatusIcon.style.marginBottom = 0;
}
exports.showFlightData


//onStart Button
//exports.onStart = function(args) {
function onStart(args) {
    console.log("ACTIVATED ONSTART isFlying: "+isFlying)
        //if (!demoMode) {
    
            //Changes the interface from ground to flight view
            hideRouteTrack()
            showFlightData()

            //2.4 Cleans flying buddies 
            buddies = []

            //Checks if there is a route planned and save it
            if(totalRoute>0) {
                onUploadRoute()
            }


            isFlying = true;

            //Hides bottom bar
            dashIcon.style.marginTop = 5000;
            settingsIcon.style.marginTop = 5000;
            flightsIcon.style.marginTop = 5000;
            engineOutIcon.style.marginTop = 0;
            backOriginIcon.style.marginTop = 0;
            butStop.style.marginTop = 0;
            windButIcon.style.marginTop = 0;
            snapshotIcon.style.marginTop = 0;
            //cameraStatusIcon.style.marginTop = 0;

            //2.5 Camera starts recording if already ON and available
            console.log("fbCamera: "+fbCamera+" cameraOn: "+cameraOn+" cameraRecording: "+cameraRecording)
            if (fbCamera!="" && cameraOn && !cameraRecording) {
                cameraREC()
            }
            

            //zeroes all other variables (distance, ori...)
            myDistance = 0;
            mySpeed = 0 //current speed
            myDuration = "00:00" //ride time
            myAltitude = 0; //current altitude
            maxSpeed = "";
            maxAltitude = 0
            totalDistance = 0
            totalDistance2 = 0
            originDistance = 0
            originTime = 0
            //totActiveHolder.text = 0;
            thisFlight = [];

            windDir = "N";
            headingDir = "S";
            myHeadingHolder.text = headingDir;
            myWindHolder.text = windDir;
            originDistanceHolder.text = "0.0"+fbMi
            myAltitudeHolder.text = "0"
            myDurationHolder.text = "00:00h";
            myDistanceHolder.text = "0.0mi"; // + fbMi; //myDistance.toFixed(1) + fbMi;
            mySpeedHolder.text = "0"

            //startRide = Date.now() 

            //2.1 Check if new flight or continues from a crashed one
            var newFlight = true
            console.log("Last flight: "+lastFlight)
            //calculates minutes between flights - if more than 2hours, auto delete the old flight and start a new one
            var startFlightDate = new Date(Number(lastFlight));
            // Do your operations
            var endFlightDate   = new Date(Date.now());
            var timeBetweenFlights = (endFlightDate - startFlightDate) / 1000;
            //console.log("Seconds between flights: "+timeBetweenFlights)
            if (timeBetweenFlights>7200) { //2 hours ago
                //2.1 delete old flight data from FB
                var activePath = "/flights/"+fbUID+"/"+Number(lastFlight);
                //console.log("DELETING "+activePath)
                var data = {};
                data[activePath] = null;
                firebase.update('/', data);               

                //2.2 Delete old entry
                db.execSQL("DELETE FROM flight WHERE fid=?", [Number(lastFlight)], function(err, id) {
                    console.log("Deleted last flight from Sqlite.");
                });

                lastFlight = ""
            }
            if (lastFlight!= "") {
                console.log("CRASHED FLIGHT - READ DATABASE")
                newFlight = false

                //2.2 Check if there is an interrupted flight
                if (db!=null) {
                    db.get('SELECT * FROM flight WHERE fid=?', [lastFlight], function(err, loadedData) {
                        //console.log("Checking if flight was finished: ", loadedData);  // Prints [["Field1", "Field2",...]]
                        if (loadedData!=null) {
                            console.log("Flight "+lastFlight+" was not finished.")
                            var flightData = JSON.parse(loadedData[18])
                            //Alert user in the case of previous flight not finished
                            dialogs.confirm({
                                title: L('continueFlightTitle'),
                                message: L('continueFlightMessage'),
                                okButtonText: L('continueFlight'),
                                cancelButtonText: L('startNew')
                            }).then(function (resulta) {
                                if (resulta) { 
                                    //Continue flight
                                    console.log("Continua voo: "+lastFlight);
                                    //2.6 loads Buddies list, wind direction, max speed
                                    hasCrashed = true;
                                    maxSpeed = Number(appSettings.getString("bkp_maxSpeed", "0"));
                                    if (isNaN(maxSpeed)) { maxSpeed = 0}
                                    myMaxSpeedHolder.text = parseInt(maxSpeed)
                                    /*
                                    if (buddies!= undefined) {
                                        buddies = JSON.parse(appSettings.getString("bkp_buddies" , "[]"));
                                    } else {
                                        buddies = []
                                    }
                                    */

                                    newFlight = false;
                                    fID = loadedData[0];
                                    windDir = loadedData[17];
                                    totalDistance = Number(loadedData[6]);
                                    originLat = flightData[0]["lat"];
                                    originLon = flightData[0]["lng"];
                                    originAltitude = flightData[0]["altitude"];
                                    thisFlight = flightData;
                                    startRide = Number(fID) 
                                    myWindHolder.text = windDir
                                    

                                    //update Origin marker
                                    map.removeMarkers(["origin"])
                                    map.addMarkers([
                                        {
                                            id: "origin", // can be user in 'removeMarkers()'
                                            lat: originLat, // mandatory
                                            lng: originLon, // mandatory
                                            title: L('origin'), // no popup unless set
                                            subtitle: L('markerStartContent'),
                                            icon: 'res://ic_origin', // preferred way, otherwise use:
                                        //   icon: 'https://scontent.xx.fbcdn.net/v/t1.0-1/s100x100/1472851_10152060644647922_1668472124_n.jpg?oh=adaf8371a460d6fc342f0744692e20fa&oe=59BC3A44', // from the internet (see the note at the bottom of this readme), or:
                                        // iconPath: 'res/markers/home_marker.png',
                                        onTap: onTap,
                                        onCalloutTap: onCalloutTap
                                        }
                                    ])
/*
                                    //Re-save the origin point
                                    //console.log('flights/'+fbUID+'/'+fID+'/data/0')
                                    firebase.setValue(
                                        'flights/'+fbUID+'/'+fID+'/data/0',
                                        {
                                                altitude: originAltitude,
                                                date: Number(fID),
                                                lat: originLat,
                                                lng: originLon,
                                                speed: result.value["data"][0]["speed"]
                                        }
                                    );
*/
                                } else { 
                                    //2.2 Delete previous flight
                                    db.execSQL("DELETE FROM flight WHERE fid=?", [Number(lastFlight)], function(err, id) {
                                        console.log("Deleted last flight from Sqlite.");
                                    });

                                    //start new
                                    newFlight = true
                                    hasCrashed = false
                                    fID = Date.now();
                                    appSettings.setString("lastFlight", String(fID));
                                    lastFlight = appSettings.getString("lastFlight");

                                    startRide = fID;

                                    //2.2 Update local database
                                    if (db!=null) {
                                        db.execSQL('INSERT INTO flight (fid, maxAltitude, maxSpeed, duration, distance, windDir, isFinished) VALUES (?, ?, ?, ?, ?, ?, ?)', [Number(fID), 0, 0, 0, 0, windDir, false], function(err, id) {
                                            console.log("Created current file entry on SQLite - NEW FLIGHT");
                                        }, error => {
                                            console.log("INSERT ERROR", err);
                                        })
                                    }
                                }
                            })
                            
                        }
                    });
                } //ends if db.null   
            } else {
                //console.log("NEW FLIGHT - SAVE DATABASE")
                newFlight = true
                hasCrashed = false
                fID = Date.now();
                startRide = fID; 
                appSettings.setString("lastFlight", String(fID));
                lastFlight = appSettings.getString("lastFlight");
                //console.log("NEW FLIGHT: "+lastFlight+" fID: "+fID)

                //2.2 Update local database
                if (db!=null) {
                    db.execSQL('INSERT INTO flight (fid, maxAltitude, maxSpeed, duration, distance, windDir, isFinished) VALUES (?, ?, ?, ?, ?, ?, ?)', [Number(fID), 0, 0, 0, 0, windDir, false], function(err, id) {
                        console.log("Created current file entry on SQLite - NEW FLIGHT");
                    }, error => {
                        console.log("INSERT ERROR", err);
                    })
                }
            } //ends IF LASTFLIGHT
            
            if (showPath) {
                showPathIcon.src = "res://ic_show_route"
            }

            // remove all markers
            map.removeMarkers(activeUsers);
            activeUsers = [];

            //resets map zoom level
            map.setZoomLevel(
            {
                level: Number(fbZoomLevel), // mandatory, 0-20
                animated: true // default true
            })


            //captures current position
            var startSpeed = 20;
            var location = geolocation.getCurrentLocation({desiredAccuracy: 3, updateDistance: 0, minimumUpdateTime: 0})
            .then(function(loc) {
                if (loc) {
                    originLoc = loc;
                    //2.1 saves origin data
                    console.log("NewFlight? "+newFlight)
                    if (newFlight) {
                        originLat = originLoc.latitude;
                        originLon = originLoc.longitude;
                        originAltitude = originLoc.altitude;
                        //console.log("FID EM LOCATION: "+fID+" LASTFLIGHT: "+lastFlight)
                        fID = lastFlight
                        var oriSpeed = args.speed
                        if (oriSpeed==undefined) {
                            oriSpeed = 0
                        }
                        /*
                        //2.1 saves in realtime
                        firebase.setValue(
                            'flights/'+fbUID+'/'+fID+'/data/0',
                            {
                                    altitude: originAltitude,
                                    date: Number(lastFlight),
                                    lat: originLat,
                                    lng: originLon,
                                    speed: oriSpeed
                            }
                        );
                        */
                        //2.2 Save it local
                        var tempData = []
                        tempData.push({lat:originLat, lng:originLon, altitude:originAltitude, speed:oriSpeed, date:Number(lastFlight)})
                        if (db!=null) {
                            db.execSQL('UPDATE flight SET data = ? WHERE fid = ?', [JSON.stringify(tempData), fID], function(err, id) {
                                console.log("Created current file entry on SQLite - NEW FLIGHT");
                            }, error => {
                                console.log("INSERT ERROR", err);
                            })
                        }

                    }

                    //gets name of the location
                    geoPlace = GOOGLE_GEOCODING_URL+originLat+","+originLon+"&key="+GOOGLE_GEOCODING_KEY
                    fetchModule.fetch(geoPlace, {
                        method: "GET"
                    })
                    .then(function(response) {
                        var m = JSON.parse(response._bodyInit)
                        //originLocation = m.results[0].address_components[0].short_name+", "+m.results[0].address_components[2].short_name
                        //guarantee is reading city/state - as Google may not delivery data in the same order
                        if (m.results[1].address_components[1].types[0]=="locality") {
                            originLocation = m.results[1].address_components[1].short_name+", "+m.results[1].address_components[3].short_name  //returns Homestead but not Belle Glade
                        } else {
                            originLocation = m.results[1].address_components[0].short_name+", "+m.results[1].address_components[2].short_name  //returns Homestead but not Belle Glade
                        }
                        console.log("VOLTOU: "+originLocation)
                    }, function(error) {
                        console.log(JSON.stringify(error));
                    })

                    startSpeed = args.speed;

                    previousLoc = loc;

                    //Draws origin marker
                    //console.log("criando o icone de origin")
                    map.addMarkers([
                        {
                            id: "origin", // can be user in 'removeMarkers()'
                            lat: originLat, // mandatory
                            lng: originLon, // mandatory
                            title: L('origin'), // no popup unless set
                            subtitle: L('markerStartContent'),
                            icon: 'res://ic_origin', // preferred way, otherwise use:
                        //   icon: 'https://scontent.xx.fbcdn.net/v/t1.0-1/s100x100/1472851_10152060644647922_1668472124_n.jpg?oh=adaf8371a460d6fc342f0744692e20fa&oe=59BC3A44', // from the internet (see the note at the bottom of this readme), or:
                        // iconPath: 'res/markers/home_marker.png',
                        onTap: onTap,
                        onCalloutTap: onCalloutTap
                        }
                    ])

                    //Gets data from weather underground
                    geoweather = "https://api.wunderground.com/api/"+WU_KEY+"/conditions/q/"+originLat+","+originLon+".json"
                    //console.log(geoweather)
                    fetchModule.fetch(geoweather, {
                        method: "GET"
                    })
                    .then(function(response) {
                        //alert({title: "GET Response", message: JSON.stringify(response), okButtonText: "Close"});
                        var m = JSON.parse(response._bodyInit)
                        originWeather = m.current_observation.weather

                        originCity = m.current_observation.display_location.full
                        originCountry = m.current_observation.display_location.country.toLowerCase()
                        if (fbCountry=="") {
                            //sets default country for future trips
                            appSettings.setString("country", originCountry);
                        }
                        console.log("originCountry loaded: "+originCountry)
                        if (fbMeasurement === "imperial") {
                            originWind = m.current_observation.wind_dir+" "+Number(m.current_observation.wind_mph).toFixed(0)+" "+fbSp
                            originTemp = Number(m.current_observation.temp_f).toFixed(0)+"°F"
                        } else {
                            originWind = m.current_observation.wind_dir+" "+Number(m.current_observation.wind_kph).toFixed(0)+" "+fbSp
                            originTemp = Number(m.current_observation.temp_c).toFixed(0)+"°C"
                        }

                    }, function(error) {
                        console.log(JSON.stringify(error));
                    })
                    
                    if (fbMeasurement === "imperial") {
                        fbMi = "mi"
                        myAltitude = parseInt(loc.altitude * 3.28084); 
                        mySpeed = parseInt(loc.speed / 0.447).toFixed(1);
                        originWind = JSON.stringify(m.current_observation.wind_dir)+" "+Number(JSON.stringify(m.current_observation.wind_mph)).toFixed(0)+fbSp
                        originTemp = Number(JSON.stringify(m.current_observation.temp_f)).toFixed(0)+"°F"
                    } else {
                        fbMi = "km"
                        mySpeed = parseInt(loc.speed * 3.6).toFixed(1);
                        myAltitude = parseInt(loc.altitude);
                        originWind = JSON.stringify(m.current_observation.wind_dir)+" "+Number(JSON.stringify(m.current_observation.wind_kph)).toFixed(0)+fbSp
                        originTemp = Number(JSON.stringify(m.current_observation.temp_c)).toFixed(0)+"°C"
                    }
                   
                    myDirection = headingCompass(loc.direction)

                    myAltitudeHolder.text = parseInt(myAltitude).toFixed(0);
                    mySpeedHolder.text = parseInt(mySpeed).toFixed(0);
                    myDistanceHolder.text = "0.0mi"; // + fbMi; //myDistance.toFixed(1) + fbMi;

                    map.setCenter({
                        lat: originLat, // + 0.02600, //0.02174,
                        lng: originLon,
                        animated: true
                    });


                     //2.1 Records into Firebase 
                    firebase.setValue(
                        'active/'+fbUID,
                        {
                                nick: fbNick,
                                icon: fbIcon,
                                photo: fbPhoto,
                                speed: originLoc.speed,
                                altitude: originLoc.altitude,
                                direction: originLoc.direction,
                                location: { 
                                    latitude: originLoc.latitude,
                                    longitude: originLoc.longitude
                                },
                                uid: fbUID,
                                record: Date.now()                                  
                        }
                    ).then(
                        function (result) {
                            //console.log("created key: " + result.key);
                            //SEND FCM "John just took off!"
                            
                        }
                    );
                }
            }, function(e){
                alert(L('errorStartingFlight')+": " + e.message);
            });

            //set mapstyle
            selectedMap = appSettings.getString("map", "Streets");
            /*
            if (selectedMap==="Streets") {
                map.setMapStyle(mapbox.MapStyle.STREETS);
            } else if (selectedMap==="Light") {
                map.setMapStyle(mapbox.MapStyle.LIGHT);
            }  else if (selectedMap==="Dark") {
                map.setMapStyle(mapbox.MapStyle.DARK);
            } else if (selectedMap==="Satellite") {
                map.setMapStyle(mapbox.MapStyle.SATELLITE);
            }  else if (selectedMap==="Hybrid") {
                map.setMapStyle(mapbox.MapStyle.HYBRID);
            }
            */
            //map.setMapStyle(mapbox.MapStyle.OUTDOORS);
            //console.log(selectedMap)
            //starts timer
            //timer();
            //calcRidingTime()

            //Send message to ALL pilots informing about the take-off
            firebase.setValue(
                'messages/'+fbUID,
                {
                        msg: fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgTookOff'),
                        uid: fbUID,
                        nick: fbNick,
                        record: Date.now()                                
                }
            );

            insomnia.keepAwake().then(function() {
                console.log("Insomnia is active");
            })

            
        //} //demoMode is false
} //finish onStart
exports.onStart = onStart;


function startWatchId(args) {
    console.log("Watching id")
    watchId = geolocation.watchLocation(
    function (loc) {
        if (loc) {
            checkStart(loc)    
            
            updateDash(loc)
        }
    }, 
    function(e){
        console.log("Error watchID: " + e.message);
    },
    {desiredAccuracy: 3, updateDistance: 0, minimumUpdateTime: 0});

}

//Auto starts flight
function checkStart(args) {
    console.log("*** CHECKING START ***")
    //auto start/stop
    if (!isFlying) {
        //if altitude > oriAltitude + 5meters AND speed > 5mph - it's flying!! so, starts updateDash, set button to STOP, ...
        if ((args.speed>2.2352) && ((args.altitude-originAltitude) > 5) ) {
            console.log("Auto started!!!!")
            onStart(args);
            //butActionHolder.backgroundColor = "#FF0000";
        }
    }
}
//check if flight has ended
setInterval(function() {
    //console.log("curSpeed: "+curSpeed)
    if (isFlying && curSpeed<.5 && !demoMode) { //only shows if flying
        console.log("Auto stopped!!!!")
        //onStart(previousLoc);
        onStop(previousLoc);  
    }
}, 15000); //15s

//Handles clicks in the Active Pilot list
exports.listViewItemTap = function(args) {
    //Capture coordinates
    var a = activePilots.getItem(args.index).pLoc;
    var aa = a.latitude;
    var ab = a.longitude;
    //console.log("myLat: "+curLat+" ploc: "+aa)
    //console.log("myLon: "+curLon+" ploc: "+ab)
    //console.log("distance: "+activePilots.getItem(args.index).listDistance)
    var pp = Date.now()

    //Draw polyline
    map.addPolyline({
        id: pp, // optional, can be used in 'removePolylines'
        color: '#FF0000', // Set the color of the line (default black)
        width: 3, //Set the width of the line (default 5),
        opacity: 0.8,
        points: [
            {
              'lat': curLat,
              'lng': curLon
            },
            {
              'lat': aa,
              'lng': ab
             }
        ]
    });

    map.setViewport(
        {
            bounds: {
            north: curLat,
            east: curLon,
            south: aa,
            west: ab
            },
            animated: true // default true
        })
   
    //set allowZoom to false (this needs to be added in the autoZoom timer)
    allowZoom = false;

    //set zoom to fit the entire selection (find a way to calculate it)
    //get distance first and calculate best zoomLevel
    var dd = activePilots.getItem(args.index).listDistance;
    var dz = 13;
    if (fbMeasurement === "imperial") {
        if(dd>1.5 && dd<=2.5) {
            dz = 11.5
        } else if(dd>2.5 && dd<=10) {
            dz = 10.5
        } else if(dd>10 && dd<=15) {
            dz = 9
        } else if(dd>15) {
            dz = 8
        }
    } else {
        if(dd>2 && dd<=4) {
            dz = 11.5
        } else if(dd>4 && dd<=16) {
            dz = 10.5
        } else if(dd>16 && dd<=24) {
            dz = 9
        } else if(dd>24) {
            dz = 8
        }
    }
    dz = 13;
    //close listView
    drawer.closeDrawer();


    //start timer 10seg  to clean up the polyline (timeout)
    setTimeout(function() {
        map.removePolylines([pp]);
        allowZoom = true

        map.setZoomLevel(
            {
                level: 13, // 13mandatory, 0-20
                animated: true // default true
            }
        )

        map.setCenter({
            lat: curLat, // + 0.02600, //0.02174,
            lng: curLon,
            animated: true
        });



    }, 10000);

    //Updates tracking area
    if (!isFlying) {
        //Set tracking area with data from the selected pilot
        trackedID = activePilots.getItem(args.index).listKey
        trackPilotText.text = activePilots.getItem(args.index).listNick
        trackPilotIcon.src = activePilots.getItem(args.index).listIcon
        trackDistanceHolder.text = activePilots.getItem(args.index).listDistance+activePilots.getItem(args.index).listMiles+activePilots.getItem(args.index).distHeading
        trackHeadingHolder.text = activePilots.getItem(args.index).listSpeed
        trackAltHolder.text = activePilots.getItem(args.index).listAltitude

        trackDist = activePilots.getItem(args.index).listDistance

/*
        {   listMiles:fbMi+" ", 
        distHeading: " "+distBearing,
        listKey:result.value[uid]["uid"], 
        listHeading:headingCompass(result.value[uid]["direction"]), 
        listDistance:xd.toFixed(1),
        listIcon:'res://'+result.value[uid]["icon"], 
        listAltitude:parseInt(xalt)+fbFt,
        listNick: anick, 
        listPhoto:result.value[uid]["photo"],
        isMe:isMe,
        listSpeed:parseInt(xspeed)+fbSp,
*/
    }
}

//Show/hide route path while flying
exports.onShowRoute = function() {
    if (showPath) {
        showPath = false;
        showPathIcon.src = "res://ic_hide_route"
        map.removePolylines([1]);
        autoTrace = appSettings.setString("autoTrace", "off");
    } else {
        showPath = true;
        showPathIcon.src = "res://ic_show_route"
        autoTrace = appSettings.setString("autoTrace", "on");
    }
};

//Share route path with others
function onUploadRoute() {
    if(totalRoute>0) {
        //save on FB
        var rID = Date.now()
        var rdist = totalRoute;
        if (fbMeasurement==="imperial") {
            rdist = rdist / 0.621371;
        }
        firebase.setValue(
            'routes/'+fbUID,
            {
                    msg: fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgRoutePlanMsg',totalRoute.toFixed(1)+fbMi),
                    uid: fbUID,
                    nick: fbNick,
                    distance: rdist,
                    record: rID,
                    data: JSON.parse(JSON.stringify(myRoute))                              
            }
        );

        //send alert to everybody
        feedback.warning({
            title: L('msgRoutePlanTitle'),
            titleColor: new color.Color("#FFFFFF"),
            position: FeedbackPosition.Top, // iOS only
            type: FeedbackType.Custom, // this is the default type, by the way
            message: L('msgRoutePlanSent'),
            messageColor: new color.Color("#FEFEFE"),
            duration: 5000,
            backgroundColor: new color.Color("#EE2A7B"),
            icon: "ic_route_plan", // in App_Resources/platform folders
            onTap: function() { console.log("showCustomIcon tapped") }
        });
    } else {
        alert(L('alertUploadRoute'))
    }
};
exports.onUploadRoute = onUploadRoute

//button STOP Flight
function onStop(args) {
    //Ask if want to finish
    dialogs.confirm({
        title: L('endFlightTitle'),
        message:L('endFlightMsg'),
        okButtonText: L('yes'),
        cancelButtonText: L('no')
    }).then(function (result) {
        // result argument is boolean
        //console.log("Dialog result: " + result);
        if (result) { 
            //Hides totActive and fbIconHolder and shows bottom bar
            dashIcon.style.marginTop = 0;
            settingsIcon.style.marginTop = 0;
            flightsIcon.style.marginTop = 0;
            engineOutIcon.style.marginTop = 5000;
            backOriginIcon.style.marginTop = 5000;
            butStop.style.marginTop = 5000;
            snapshotIcon.style.marginTop = 5000;
            //cameraStatusIcon.style.marginTop = 5000;

            hideFlightData()
            showRouteTrack()
            
            demoMode = false
            isFlying = false

            //Stop timer
            seconds = 0; minutes = 0; hours = 0;


            //Stop capturing location
            if (watchId) {
                console.log("Finishing watchID")
                geolocation.clearWatch(watchId);
            }

            //Set mySpeed to MaxSpeed
            myAltitudeHolder.text = "0"; //parseInt(maxAltitude).toFixed(0);
            myMaxSpeedHolder.text = ""; //parseInt(maxSpeed);

            mySpeedHolder.text = "0"; //String(parseInt(speedAvg/(thisFlight.length-zeroes))); 
            if (mySpeedHolder.text==="NaN") {
                mySpeedHolder.text = 0;
            }
            totActive = "";
            
            totActiveHolder.text = totActive;

            myDistanceHolder.text = "0.0mi";

            originDistanceHolder.text = "0.0"+fbMi;
            //originTimeHolder.text = "0 min";
            
            //map.removePolylines();

            //Saves current zoomLevel
            map.getZoomLevel().then(
                function(result) {
                    //console.log("Mapbox getZoomLevel done, result: " + JSON.stringify(result));
                    fbZoomLevel = JSON.stringify(result);
                    appSettings.setString("zoomLevel", fbZoomLevel);
                },
                function(error) {
                    console.log("mapbox getZoomLevel error: " + error);
                }
            )

            //remove from Firebase
            var activePath = 'active/'+fbUID;
            var data = {};
            data[activePath] = null;
            firebase.update('/', data);

            //remove all markers
            //mapbox.removeMarkers();
            //map.destroy();
            map.removeMarkers(activeUsers)
            //activeUsers.push("origin"); //saves the origin marker in the list
            activePilots.length = 0; //= []; 
            cleanActive = [];
            //previousLoc = 0;

            //1.2.0 Calculates bounds, average speed, etc - to speed up loading on Flight page
            var norte
            var sul 
            var leste
            var oeste
            var latCoord = []
            var lngCoord = []

            var ms = 0;
            var asp = 0;
            var dt = 0
            var ma = 0;
            var tt = 0; 
            var zeroes = 0
            var speedAvg = 0

            for (i=0;i<thisFlight.length;i++) { 
                latCoord.push(thisFlight[i].lat)
                lngCoord.push(thisFlight[i].lng)

                //calculate maxSpeed
                if (thisFlight[i].speed>ms) {
                    //console.log("max speed: "+flightData[i].speed+" at point "+flightData[i].lat+", "+flightData[i].lng+" - (i): "+i);
                    ms = thisFlight[i].speed
                }
                //console.log("max. speed: "+ms+" in mph: "+(ms / 0.447))
 
                //calculate maxAltitude
                if (thisFlight[i].altitude>ma) {
                    //console.log("max altitude: "+flightData[i].altitude+" at point "+flightData[i].lat+", "+flightData[i].lng+" - (i): "+i);
                    ma = thisFlight[i].altitude
                }
                //console.log("max. altitude: "+ma+" in ft: "+(ma * 3.28084))

                //calculate avgSpeed (with zeroes)
                if (thisFlight[i].speed<=0) {
                    asp = asp + 0
                    zeroes++
                } else {
                    asp = asp + thisFlight[i].speed;
                }
                //console.log("avg speed (no zeroes): "+asp+" in mph: "+(asp/(i+1) / 0.447)+" (i): "+i)
                //console.log("avg speed (with zeroes): "+asp+" in mph: "+(asp/(i+1-zeroes) / 0.447)+" (i): "+i)
                               
            }

            norte = Math.max.apply(null, latCoord)
            sul = Math.min.apply(null, latCoord)
            leste = Math.min(...lngCoord)
            oeste = Math.max(...lngCoord)

            //converts back
            var avgSpeed = asp/(thisFlight.length-zeroes);  


            //Saves flight
            //converts speed, distance and altitude back to metric
            if (fbMeasurement === "imperial") {
                maxAltitude = parseInt(maxAltitude / 3.28084);
                maxSpeed = parseInt(maxSpeed * 0.447); //back to m/s
                myDistance = Number(myDistance / 0.000621371);
                speedAvg = Number(avgSpeed);
                
            } else {
                maxSpeed = parseInt(maxSpeed * 3.6);
                maxAltitude = parseInt(maxAltitude);
                myDistance = Number(myDistance/1000);
                speedAvg = Number(avgSpeed);
            }

            fID = thisFlight[0].date; //Date.now()

            //captures and save Google's geolocation from the first datapoint
            var tdur = myDurationHolder.text.substring(0,myDurationHolder.text.length-1)
            /*
            firebase.setValue(
                'flights/'+fbUID+'/'+fID,
                {
                        fid: fID,
                        data: JSON.parse(JSON.stringify(thisFlight)),
                        maxAltitude: maxAltitude.toFixed(0),
                        maxSpeed: String(maxSpeed),
                        duration: tdur,
                        distance: myDistance.toFixed(1),
                        avgSpeed: String(speedAvg),
                        boundNorth: norte,
                        boundSouth: sul,
                        boundEast: leste,
                        boundWest: oeste,
                        weatherIcon: originWeather,
                        weatherTemp: originTemp,
                        weatherWind: originWind,
                        place: originLocation

                }
            );
            */

            //Safe routine to save only if fbUID AND lastFlight data is available
            console.log("fbUID: "+fbUID+" lastFlight: "+lastFlight) 
            if(fbUID!=undefined && lastFlight!=undefined && lastFlight!=null) {
                //2.1 Updates things like place, boundaries, etc
                firebase.update(
                    'flights/'+fbUID+'/'+lastFlight,
                    {
                        maxAltitude: maxAltitude.toFixed(0),
                        maxSpeed: String(maxSpeed),
                        duration: tdur,
                        distance: myDistance.toFixed(1),
                        avgSpeed: String(speedAvg),
                        boundNorth: norte,
                        boundSouth: sul,
                        boundEast: leste,
                        boundWest: oeste,
                        weatherIcon: originWeather,
                        weatherTemp: originTemp,
                        weatherWind: originWind,
                        place: originLocation,
                        isFinished: true,
                        buddies: buddies, //2.4
                        data: JSON.parse(JSON.stringify(thisFlight)) //2.2
                    }
                )

                console.log("lastFlight: "+lastFlight)

                //saves copy to temporary database
                firebase.setValue(
                    'flights_temp/'+fbUID+'/'+lastFlight,
                    {
                            fid: Number(lastFlight),
                            maxSpeed: String(maxSpeed),
                            duration: tdur,
                            distance: myDistance.toFixed(1),
                            place: originLocation,
                            snapshots: snapNum,
                            buddies: buddies
                    }
                );

            }
            //2.2 Delete SQL entry
            db.execSQL("DELETE FROM flight WHERE fid=?", [Number(lastFlight)], function(err, id) {
                console.log("Deleted last flight from Sqlite.");
            });

            myDistance = 0;

            alertGrid.style.backgroundColor = "#182126";
            myHeadingHolder.text = ""

            myRoute.length = 0;
            myRoute = [];
            previousRoute = 0;
            drawPlannedRoute = true;
            snapNum = 0

            //Send message to ALL pilots informing about the landing
            firebase.setValue(
                'messages/'+fbUID,
                {
                        msg: fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgLanded'),
                        uid: fbUID,
                        nick: fbNick,
                        record: Date.now()                                
                }
            );

            //send to flights page
            //console.log("sending to flight page autosave")
            appSettings.setString("fid", String(lastFlight));
            //console.log("ENVIANDO FID PARA FLIGHT PAGE: "+lastFlight)
            appSettings.setString("lastFlight", "");
            lastFlight = appSettings.getString("lastFlight", "");
           // db.close()
           feedback.hide();
            var navigationEntry = {
                moduleName: "flight-page",
                context: {fid: Number(lastFlight)},
                animated: false,
                clearHistory: true
            };
            frames.topmost().navigate(navigationEntry);

            //2.5 Camera off
            if (fbCamera!="" && cameraOn) {
                cameraOFF()
            }

            insomnia.allowSleepAgain().then(function() {
                console.log("Insomnia is inactive, good night!");
                //performanceMonitor.stop();
            })
        

        } else {
            console.log("fora de result")
        }
    }); //finish alert stop flight
}
exports.onStop = onStop;

//Route shared and onDownloadRoute
var readRoutes = [];
setInterval(function() {
    var onQueryEvent = function(result) {
        if (!result.error) {     
            for(let uid in result.value){
                //delete entries older than 370 days (meaning they are dead ones) - 8 days = 691200
                var oldtime = result.value[uid]["record"]
                var now = Date.now() 
                var timeLapse = (now-oldtime)/1000
                if (timeLapse>31968000) {
                    //remove from Firebase
                    var activePath = 'routes/'+result.value[uid]["uid"];
                    var data = {};
                    data[activePath] = null;
                    firebase.update('/', data);
                } else {
                    //Do not print the own user    
                    //console.log(result.value[uid]["uid"]+"-"+fbUID)  
                    if(result.value[uid]["uid"]!=fbUID && readRoutes.indexOf(result.value[uid]["record"]) < 0 && parseInt(timeLapse)<60) {
                        //console.log(result.value[uid]["nick"].toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgRoutePlanMsgReceived'))
                        //console.log(result.value[uid]["msg"]+" ("+parseInt(timeLapse)+" "+L('msgSecAgo'))
                        feedback.warning({
                            title: result.value[uid]["nick"].toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();})+" "+L('msgRoutePlanMsgReceived'),
                            message: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+" "+L('msgSecAgo'),
                            duration: 10000,
                            backgroundColor: new color.Color("#EE2A7B"),
                            icon: "ic_route_plan", // in App_Resources/platform folders
                            onTap: () => { loadPlannedRoute(result.value[uid]["data"],result.value[uid]["distance"]); } //finish on tap
                        });
                        var speakOptions = {
                            text: result.value[uid]["msg"]+" ("+parseInt(timeLapse)+" "+L('msgSecAgo'),
                            speakRate: 0.5,
                            pitch: 1.0,
                            volume: 1.0
                        };
                        if (voiceAlert=="true") {
                            TTS.speak(speakOptions)
                        } 
                        console.log("2296")
                        readRoutes.push(result.value[uid]["record"])
                    }
                }

            }
        }; //end if onQuery
    } //end onQuery
    firebase.query(
        onQueryEvent,
        "/routes",
        {
            singleEvent: true,
            orderBy: {
                type: firebase.QueryOrderByType.CHILD,
                value: 'uid' 
            }
        }
    ); 

}, 10000); //60000 = 1 minute

//Load previous route
function loadPlannedRoute(dataRoute,dist) {
    //console.log("em load planned route "+dist)
    myRoute = dataRoute;

    if (fbMeasurement==="imperial") {
        dist = dist * 0.621371;
    }
    totalRoute = Number(dist);
    previousRoute = dataRoute[dataRoute.length-1];

    map.removePolylines([2]);
    map.removeMarkers();
    map.addPolyline({
            id: 2, // optional, can be used in 'removePolylines'
            color: '#EE2A7B', // Set the color of the line (default black) - #30BCFF (blue)
            width: 3.5, //Set the width of the line (default 5)
            opacity: .8,
            points: JSON.parse(JSON.stringify(myRoute))
    });

    //Changes only if not "in flight"
    if (!isFlying) {
        routeTagHolder.text = fbMi;
        routeDistHolder.text = dist.toFixed(1);
        //speedIcon.style.marginLeft = 5000;
        //deleteRoute.style.marginTop = 0;
        //uploadRoute.style.marginTop = 5;
    }
    
    var norte
    var sul 
    var leste
    var oeste
    var latCoord = []
    var lngCoord = []
    for (i=0;i<myRoute.length;i++) { 
        latCoord.push(myRoute[i].lat)
        lngCoord.push(myRoute[i].lng)
    }
    norte = Math.max.apply(null, latCoord)
    sul = Math.min.apply(null, latCoord)
    leste = Math.min(...lngCoord)
    oeste = Math.max(...lngCoord)
    map.setViewport(
    {
        bounds: {
        north: norte,
        east: leste,
        south: sul,
        west: oeste
        },
        animated: true // default true
    })
    map.addMarkers([
        {
            id: "start_flight", // can be user in 'removeMarkers()'
            lat: myRoute[0].lat, // mandatory
            lng: myRoute[0].lng, // mandatory
            title: L('markerStartTitle'), // no popup unless set
            subtitle: L('markerStartContent'),
            icon: 'res://ic_start_flight'
        }
    ])
    
    map.addMarkers([
        {
            id: "end_flight", // can be user in 'removeMarkers()'
            lat: myRoute[myRoute.length-1].lat, // mandatory
            lng: myRoute[myRoute.length-1].lng, // mandatory
            title: L('markerEndTitle'), // no popup unless set
            subtitle: L('markerEndContent'),
            icon: 'res://ic_end_flight'
        }
    ])
}

//Download last saved route
function onDownloadRoute() {
    var onQueryEvent = function(result) {
        if (!result.error) {   
            //console.log("rota carregada: "+String(result.value))     
            if (String(result.value)!="null") {
                loadPlannedRoute(result.value["data"],result.value["distance"])
            } else {
                alert(L('alertDownloadRoute'))
            }     
        } else {
            //error - no routes
            //console.log("There is no route available for download")      
        } //end if onQuery
    } //end onQuery
    firebase.query(
        onQueryEvent,
        "/routes/"+fbUID,
        {
            singleEvent: true,
            orderBy: {
                type: firebase.QueryOrderByType.CHILD,
                value: 'uid' 
            }
        }
    );
}
exports.onDownloadRoute = onDownloadRoute

//Controls tracking pilots - updates every 10s
setInterval(function() {
    //console.log("trackedID: "+trackedID)
    if (!isFlying && hasLocationEnabled) { 

        if (activeUsers.length>0) {
            map.removeMarkers(activeUsers)
            //map.removePolylines()
        }
        var onQueryEvent = function(result) {
        if (!result.error) { 
            console.log(JSON.stringify(result))     
            var firebaseTotal = 0;      
            for(let uid in result.value){
                //delete entries older than 5min (meaning they are dead ones)
                console.log("************UID active: "+uid+" myUID: "+fbUID)
                var oldtime = result.value[uid]["record"]
                var now = Date.now() 
                var timeLapse = (now-oldtime)/1000
                if (timeLapse>300) {
                    //remove from Firebase
                    var activePath = 'active/'+result.value[uid]["uid"];
                    var data = {};
                    data[activePath] = null;
                    firebase.update('/', data);
                } else if (result.value[uid]["location"]!=undefined) {
                    //DEMO MODE GROUND VIEW
                    var dbLoc = result.value[uid]["location"];
                    var xd
                    var xalt
                    var xspeed
                    var xm = L('feet')
                    var demoAlt = result.value[uid]["altitude"]
                    var demoLat = dbLoc.latitude
                    var demoLon = dbLoc.longitude
                    var demoSpeed = result.value[uid]["speed"]
                    var demoLoc = dbLoc 

                    var usePhoto = result.value[uid]["photo"];

                    if (result.value[uid]["nick"].substr(0,6) === "(Demo)") {
                        //create "fake" location here based on current location
                        //console.log(Math.random() * 0.14 - 0.07);
                        demoLat = curLat + (Math.random() * 0.14 - 0.07); //generates a random number between 20 and 600 meters (65-1968ft)
                        demoLon = curLon + (Math.random() * 0.016 - 0.008)
                        xd = getDistanceFromLatLonInKm(demoLat,demoLon,curLat,curLon) * 1000
                        demoSpeed = demoSpeed + (Math.floor(Math.random() * (27 - 8 + 1) ) + 8); //generates a random number between 8 and 27 mps (18-60mph)
                        demoAlt = demoAlt + (Math.floor(Math.random() * (600 - 20 + 1) ) + 20); //generates a random number between 20 and 600 meters (65-1968ft)
                        demoLoc = {latitude:demoLat, longitude: demoLon} 
                    } else {
                        xd = getDistanceFromLatLonInKm(dbLoc.latitude,dbLoc.longitude,curLat,curLon) * 1000
                    }
                                  
                    //var xd = getDistanceFromLatLonInKm(dbLoc.latitude,dbLoc.longitude,curLat,curLon) * 1000
                    var xdClose = xd/1000
                    if (fbMeasurement==="imperial") {
                        xd = Number(xd * 0.000621371); //converts meters to mi
                    } else {
                        xd = Number(xd / 1000); //converts meters to km
                    }       
                    //adds to activeUsers table and create markers if they havent one yet
                    activeUsers.push(result.value[uid]["uid"]) 
                    firebaseTotal = firebaseTotal + 1;

                    
                    if (fbMeasurement==="imperial") {
                        xalt = parseInt(demoAlt * 3.28084);
                        xspeed = parseInt(demoSpeed / 0.447);
                        xm = L('feet')
                    } else {
                        xalt = demoAlt;
                        xspeed = parseInt(demoSpeed * 3.6);
                        xm = L('meters')
                    } 
                    //GROUND VIEW
                    if(result.value[uid]["nick"]!=fbNick && String(map)!="undefined") {
                        var myIcon = 'res://'+result.value[uid]["icon"]
                        //console.log("Icone original: "+myIcon)
                        //console.log("Icone modificado: "+result.value[uid]["uid"].substr(0,5).toLowerCase())
                        if (result.value[uid]["uid"].substr(0,5).toLowerCase() === "5v9fb") { //alex
                            // myIcon = 'res://mk_'+result.value[uid]["uid"].substr(0,5).toLowerCase()
                        }
                        
                        map.addMarkers([
                            {
                                id: result.value[uid]["uid"],
                                lat: demoLat, // mandatory
                                lng: demoLon, // mandatory
                                title: result.value[uid]["nick"]+" "+L('speed')+": "+parseInt(xspeed), // no popup unless set
                                subtitle: L('altitude')+": "+parseInt(xalt)+"\r\n"+L('heading')+": "+headingCompass(result.value[uid]["direction"])+"\r\n"+L('distance')+": "+xd.toFixed(1),
                                icon: myIcon, // preferred way, otherwise use:
                            onTap: onTap,
                            onCalloutTap: onCalloutTap
                            }
                        ])
                        isMe = "";
                        //2.1.x save local picture IF it is already compacted and does not exist locally
                        //console.log("Tem "+result.value[uid]["uid"]+".jpg? "+usePhoto.indexOf(result.value[uid]["uid"]+".jpg"))
                        var path_td = fs.path.join(folder.path, result.value[uid]["uid"]+".jpg");
                        var ftd = result.value[uid]["photo"];
                        if (usePhoto!="res://ic_photo" && usePhoto.indexOf(result.value[uid]["uid"]+".jpg")>0 && !fs.File.exists(path_td)) {
                            //console.log("Salva imagem local!")
                            
                            //console.log("Userid: "+result.value[uid]["uid"])
                            //console.log("usePhoto: "+usePhoto)
                            http.getImage(ftd).then((r) => {
                                //console.log("Salvando foto: "+ftd)
                                //console.log("em: "+path_td)
                                r.saveToFile(path_td,"jpeg")
                                usePhoto = path_td;
                            }, (err) => {
                                // Argument (e) is Error!
                                //console.log(e);
                                console.log("Error loading user image! "+e)
                            });
                        } else if (fs.File.exists(path_td)) {
                            usePhoto = path_td;
                        }

                    } else {
                        isMe = "("+L('me')+") "
                    }   
                    /*                                  
                    function formatDate(date) {
                        var hours = date.getHours();
                        var minutes = date.getMinutes();
                        var secs = date.getSeconds();
                        var ampm = hours >= 12 ? 'pm' : 'am';
                        hours = hours % 12;
                        hours = hours ? hours : 12; // the hour '0' should be '12'
                        minutes = minutes < 10 ? '0'+minutes : minutes;
                        var strTime = hours + ':' + minutes + ':' + secs; //ampm;
                        return strTime;
                    }
                    */
                    var d = new Date();
                    var e = formatDate(d);
                    //Add items into the listView
                    var index = cleanActive.indexOf(result.value[uid]["uid"]);
                    var indActive = activePilots.indexOf(result.value[uid]["uid"]);

                    //Calculates bearing from ME
                    var distBearing = headingCompass(getBearing(curLat,curLon,demoLat,demoLon));  

                    if (trackedID==result.value[uid]["uid"]) {
                        trackPilotText.text = result.value[uid]["nick"]
                        trackDistanceHolder.text = xd.toFixed(1)+fbMi+" "+distBearing
                        trackHeadingHolder.text = parseInt(xspeed)+fbSp
                        trackAltHolder.text = parseInt(xalt)+fbFt
                    }
                    //resize ListNick size is length is longer than 10 digits
                    var anick = result.value[uid]["nick"]
                    if (anick.length>10) {
                        anick = result.value[uid]["nick"].substr(0,9)+"..."
                    }
                    if (index === -1) {     
                        //Adds into the listView
                        cleanActive.push(result.value[uid]["uid"]);

                        activePilots.push(
                            {   listMiles:fbMi+" ", 
                                distHeading: " "+distBearing,
                                listKey:result.value[uid]["uid"], 
                                listHeading:headingCompass(result.value[uid]["direction"]), 
                                listDistance:xd.toFixed(1),
                                listIcon:'res://'+result.value[uid]["icon"], 
                                listAltitude:parseInt(xalt)+fbFt,
                                listNick: anick, 
                                listPhoto:result.value[uid]["photo"],
                                isMe:isMe,
                                listSpeed:parseInt(xspeed)+fbSp,
                                pLoc:demoLoc
                                })

                    } else {   
                        //updates ListView
                        activePilots.splice(index,1,
                        {   listMiles:fbMi+" ",
                            distHeading: " "+distBearing, 
                            listKey:result.value[uid]["uid"], 
                            listHeading:headingCompass(result.value[uid]["direction"]), 
                            listDistance:xd.toFixed(1),
                            listIcon:'res://'+result.value[uid]["icon"], 
                            listAltitude:parseInt(xalt)+fbFt,
                            listNick: anick, 
                            listPhoto:result.value[uid]["photo"],
                            isMe:isMe,
                            listSpeed:parseInt(xspeed)+fbSp,
                            pLoc:demoLoc 
                        })
                    }
                    //console.log("Line 2790 FirebaseTotal: "+firebaseTotal)
                    totActive = firebaseTotal; //cleanActive.length;
                    //console.log("Line 2792 totActive: "+totActive)
                    totActiveHolder.text = totActive;
                }

            } //end for
            //Sorts the data by DISTANCE
            activePilots.sort(function(a,b) {return (a.listDistance > b.listDistance) ? 1 : ((b.listDistance > a.listDistance) ? -1 : 0);} );

        }; //end if onQuery
    } //end onQuery
    firebase.query(
        onQueryEvent,
        "/active",
        {
            singleEvent: true,
            // order by company.country
            orderBy: {
                type: firebase.QueryOrderByType.CHILD,
                value: 'nick' // uid -->mandatory when type is 'child'
            }
        }
    ); 

    } //ends IF isFlying
}, 10000);

//Refreshes wind information if city is different than origin
exports.onWind = function() {
    console.log("originCity: "+originCity)
    //Gets current city and compare with  weather city
    //gets name of the location
    var curCity
    var pastWeather

    geoPlace = GOOGLE_GEOCODING_URL+curLat+","+curLon+"&key="+GOOGLE_GEOCODING_KEY
    fetchModule.fetch(geoPlace, {
        method: "GET"
    })
    .then(function(response) {
        var m = JSON.parse(response._bodyInit)
        //originLocation = m.results[0].address_components[0].short_name+", "+m.results[0].address_components[2].short_name
        //guarantee is reading city/state - as Google may not delivery data in the same order
        if (m.results[1].address_components[1].types[0]=="locality") {
            curCity = m.results[1].address_components[1].short_name+", "+m.results[1].address_components[3].short_name  //returns Homestead but not Belle Glade
        } else {
            curCity = m.results[1].address_components[0].short_name+", "+m.results[1].address_components[2].short_name  //returns Homestead but not Belle Glade
        }
        console.log("curCity: "+curCity)
        //curCity = "Fort Lauderdale, FL"
        if (curCity != originCity && curCity != pastCity) {
            //Gets data from weather underground
            geoweather = "https://api.wunderground.com/api/"+WU_KEY+"/conditions/q/"+curLat+","+curLon+".json"
            fetchModule.fetch(geoweather, {
                method: "GET"
            })
            .then(function(response) {
                var m = JSON.parse(response._bodyInit)
                originWeather = m.current_observation.weather
                pastCity = m.current_observation.display_location.full
                console.log("pastCity: "+pastCity)

                if (fbMeasurement === "imperial") {
                    pastWeather = m.current_observation.wind_dir+" "+Number(m.current_observation.wind_mph).toFixed(0)+fbSp+" "+L('windGust')+" "+Number(m.current_observation.wind_gust_mph).toFixed(0)+fbSp
                } else {
                    pastWeather = m.current_observation.wind_dir+" "+Number(m.current_observation.wind_kph).toFixed(0)+fbSp+" "+L('windGust')+" "+Number(m.current_observation.wind_gust_kph).toFixed(0)+fbSp
                }
                console.log("pastWeather: "+pastWeather)
                feedback.info({
                    title: L('windIn')+" "+pastCity, //"Message from "+result.value[uid]["nick"],
                    message: pastWeather, 
                    icon: "ic_wu",
                    backgroundColor: new color.Color("#182125"),
                    duration: 10000
                });
            }, function(error) {
                console.log(JSON.stringify(error));
                feedback.info({
                    title: "Error trying to get weather info.", //"Message from "+result.value[uid]["nick"],
                    message: JSON.stringify(error), 
                    icon: "ic_wu",
                    backgroundColor: new color.Color("#182125"),
                    duration: 10000
                });
            })
        } else {
            feedback.info({
                title: L('windIn')+" "+originCity, //"Message from "+result.value[uid]["nick"],
                message: originWind, 
                icon: "ic_wu",
                backgroundColor: new color.Color("#182125"),
                duration: 10000
            });
        }
    }, function(error) {
        console.log(JSON.stringify(error));
        feedback.info({
            title: "Error trying to get weather info.", //"Message from "+result.value[uid]["nick"],
            message: JSON.stringify(error), 
            icon: "ic_wu",
            backgroundColor: new color.Color("#182125"),
            duration: 10000
        });
    })

};

//DEMO MODE FLIGHT VIEW
var demoTotalDistance = 0
setInterval(function() {
    if (fbUID!=appSettings.getString("uid")) {
        fbUID = appSettings.getString("uid");
        appSettings.setString("uid", fbUID);
    }
    
    if (isFlying) { 
        var d = new Date();
        var e = formatDate(d);
        //console.log(e)
        if (fbUID.substr(0,5) === "Ar8ar" && Number(mySpeedHolder.text)<1 || demoMode) { //Ze or Alex only || fbUID.substr(0,5) === "5v9FB"  fbUID.substr(0,5) === "Ar8ar" && 
            demoMode = true

            var demoPreviousLat
            var demoPreviousLon

            myAltitudeHolder.text = parseInt(myAltitude + (Math.floor(Math.random() * (600 - 20 + 1) ) + 20)).toFixed(0);
            mySpeedHolder.text = parseInt(mySpeed + (Math.floor(Math.random() * (27 - 8 + 1) ) + 8)).toFixed(0);
            myMaxSpeedHolder.text = parseInt((Math.floor(Math.random() * (27 - 25 + 1) ) + 25)).toFixed(0);
            //Animates speed chart
            var spc = "#696969"
            //args.speed = Math.floor(Math.random() * 35)
            if (mySpeedHolder.text >= 29) {
                speedGraph.src="res://ic_speed5"
                spc = "#E11C24"
            } else if (Number(mySpeedHolder.text) >= 23 && Number(mySpeedHolder.text) < 29) {
                speedGraph.src="res://ic_speed4"
                spc = "#F57426"
            } else if (Number(mySpeedHolder.text) >= 15 && Number(mySpeedHolder.text) < 23) {
                speedGraph.src="res://ic_speed3"
                spc = "#FFC400"
            } else if (Number(mySpeedHolder.text) >= 9 && Number(mySpeedHolder.text) < 15) {
                speedGraph.src="res://ic_speed2"
                spc = "#4BAC3B"
            } else if (Number(mySpeedHolder.text) >= 1 && Number(mySpeedHolder.text) < 9) {
                speedGraph.src="res://ic_speed1"
                spc = "#05A641"
            } else {
                speedGraph.src="res://ic_speed0"
                spc = "#696969"
            }

            //Origin data
            map.removeMarkers(["origin"])
            var demoLat = originLat + (Math.random() * 0.005 - 0.0025);
            var demoLon = originLon + (Math.random() * 0.01 - 0.0005)
            demoPreviousLat = demoLat;
            demoPreviousLon = demoLon;
            map.addMarkers([
                {
                    id: "origin", // can be user in 'removeMarkers()'
                    lat: demoLat, // mandatory
                    lng: demoLon, // mandatory
                    title: L('origin'), // no popup unless set
                    subtitle: L('markerStartContent'),
                    icon: 'res://ic_origin', // preferred way, otherwise use:
                //   icon: 'https://scontent.xx.fbcdn.net/v/t1.0-1/s100x100/1472851_10152060644647922_1668472124_n.jpg?oh=adaf8371a460d6fc342f0744692e20fa&oe=59BC3A44', // from the internet (see the note at the bottom of this readme), or:
                // iconPath: 'res/markers/home_marker.png',
                onTap: onTap,
                onCalloutTap: onCalloutTap
                }
            ])

            var demoOriginDistance = getDistanceFromLatLonInKm(demoLat,demoLon,curLat,curLon) * 1000;
            demoTotalDistance = demoTotalDistance + getDistanceFromLatLonInKm(demoPreviousLat,demoPreviousLon,curLat,curLon) * 1000;
            var groundAltitude = Number(myAltitudeHolder.text) - originAltitude
            if (fbMeasurement === "imperial") {
                //myDistance = Number(totalDistance * 0.000621371);
                myDistanceHolder.text = Number(demoTotalDistance * 0.000621371).toFixed(1) + fbMi;
                demoOriginDistance = Number(demoOriginDistance * 0.000621371);
                myAltitudeHolder.text = parseInt(Number(groundAltitude) * 3.2804)
            } else {
                //myDistance = Number(totalDistance/1000);
                myDistanceHolder.text = Number(demoTotalDistance/1000).toFixed(1) + fbMi;
                demoOriginDistance = Number(originDistance/1000);
            }

            var xx = (demoOriginDistance / Number(mySpeedHolder.text) * 60)
            originDistanceHolder.text = headingCompass(getBearing(curLat,curLon,demoLat,demoLon))+"   "+Number(demoOriginDistance).toFixed(1) + fbMi+"   "+xx.toFixed(0) + "min"

            var demoHeading = ["N","S","E","W","NE","SE","NW","SW"]
            var demoSel = Math.floor(Math.random() * 8)
            myHeadingHolder.text = demoHeading[demoSel]

            //Animates altitude chart
            if (groundAltitude < 0 ) {
                groundAltitude = groundAltitude * -1 //reverses altitude in the case took-off at 2000ft and is flying now at 1000ft - in this cenarion groundAltitude would be at -1000
            }
            if (groundAltitude >= 610) {
                altGraph.src="res://ic_alt5"
            } else if (groundAltitude >= 305 && groundAltitude < 610) { //610m = 2000ft
                altGraph.src="res://ic_alt4"
            } else if (groundAltitude >= 155 && groundAltitude < 305) { //305m = 1000ft
                altGraph.src="res://ic_alt3"
            } else if (groundAltitude >= 31 && groundAltitude < 155) { //155m = 508ft
                altGraph.src="res://ic_alt2"
            } else if (groundAltitude >= 10 && groundAltitude < 31) { //31m = 98ft
                altGraph.src="res://ic_alt1"
            } else {
                altGraph.src="res://ic_alt0"
            }


            calcRidingTime()

        }
    }
}, 1500);

//gives time for geolocation to load
setTimeout(function() {
    //console.log("Location enabled 3260: "+hasLocationEnabled)
    getOrigin();
      
      //read Facebook photo to check if it has expired
      //if so, change it to local icon
      //if not, decrease size and upload it to FB Storage
      console.log("fbPhoto: "+fbPhoto)
      // fbPhoto = "https://firebasestorage.googleapis.com/v0/b/ppg-finder.appspot.com/o/uploads%2F5v9FB2urEVcp9u4s6XdnqeZGt0n2%2Fphoto.jpg?alt=media&token=adcb54ff-b0ca-4248-8fd5-86a70609b1f7";
      //fbUID = "os4RK5mqdxeIJTMKbFJusTbNN863";
      //fbPhoto = "https://firebasestorage.googleapis.com/v0/b/ppg-finder.appspot.com/o/uploads%2F5v9FB2urEVcp9u4s6XdnqeZGt0n2%2F5v9FB2urEVcp9u4s6XdnqeZGt0n2.jpg?alt=media&token=a35791b7-2d39-4dc9-b803-3ec829c43ada"
      //localPict="no"


        //console.log(folder)

      if (fbPhoto!="res://ic_photo" && localPict==="no") {
        console.log("Buscando foto Facebook")
        fetchModule.fetch(fbPhoto, {
                method: "GET"
        })
        .then(function(response) {
            console.log("Facebook photo has expired! Replacing by local icon.")
            //console.log(response.status) //403 is URL HAS EXPIRED
            fbPhoto = "res://ic_photo";
            firebase.update(
                '/users/'+fbUID,
                {   
                    'photo': fbPhoto
                }
            );
            appSettings.setString("photo", fbPhoto); //String(fbPhoto).substr(1, fbPhoto.length-2));
        }, function(error) {
            console.log("Facebook/Storage photo is working!")
            //console.log(JSON.stringify(error));
            //Read image
            var path = fs.path.join(folder.path, fbUID+".jpg");
            console.log(path)
            http.getImage(fbPhoto).then((r) => {
                // Argument (r) is ImageSource!
                //console.log("R: "+r)

                //var image = r; // some imageSource
                //var bmp = BitmapFactory.create(r.width, r.height);
                var bmp = BitmapFactory.create(100, 100);
                
                bmp.dispose(function(b) {
                    b.insert(r);
                        
                    // ## Max dimension. Respects aspect ratio.
                    var b2 = b; //.resizeMax(50);

                    var thumb_image = b2.toImageSource();

                    var saved = thumb_image.saveToFile(
                        path,
                        enums.ImageFormat.jpeg
                    );

                    if (saved) {
                        // ## Use resized image
                        console.log("Salvou local image!!!")
                        firebase.uploadFile({
                            // the full path of the file in your Firebase storage (folders will be created)
                            remoteFullPath: 'uploads/'+fbUID+'/'+fbUID+'.jpg',
                            localFullPath: path, //selected.fileUri,
                            // get notified of file upload progress
                            onProgress: function(status) {
                                console.log("Uploaded fraction: " + status.fractionCompleted);
                                console.log("Percentage complete: " + status.percentageCompleted);
                            }
                        }).then(
                            function (uploadedFile) {
                                console.log("File uploaded: " + JSON.stringify(uploadedFile));
                                console.log("URL: "+JSON.stringify(uploadedFile.url))
                                appSettings.setString("localPict", "yes")
                                fbPhoto = uploadedFile.url;
                                firebase.update(
                                    '/users/'+fbUID,
                                    {   
                                        'photo': fbPhoto
                                    }
                                );
                                appSettings.setString("photo", fbPhoto); //String(fbPhoto).substr(1, fbPhoto.length-2));
                            },
                            function (error) {
                                alert("File upload error: " + error);
                            }
                        );
                    }
                });

            }, (err) => {
                // Argument (e) is Error!
                //console.log(e);
                console.log("Error loading Facebook/Storage image! "+e)
            });
        })
      }

    

}, 3000);

function formatDate(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var secs = date.getSeconds();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;
    var strTime = hours + ':' + minutes + ':' + secs; //ampm;
    return strTime;
}

//DEMO messages
var demoAlert = setInterval(function() {
    if (fbUID.substr(0,5) === "Ar8ar" &&  demoMode) {
        alertGrid.style.backgroundColor = "#FF1D1D";
        feedback.info({
            title: "Attention", //"Message from "+result.value[uid]["nick"],
            message: L('attentionTailWind'), 
            icon: "ic_engine_out",
            backgroundColor: new color.Color("#FF1D1D"),
            duration: 10000
        });
        var speakOptions = {
            text: L('attentionTailWind'),
            speakRate: 0.5,
            pitch: 1.0,
            volume: 1.0
        };
        TTS.speak(speakOptions) //tail wind

        setTimeout(function() {
            alertGrid.style.backgroundColor = "#30BCFF";
            clearInterval(demoAlert)
        }, 11000); 
    }
}, 30000);


//Checks for airspace availability
function loadAirspaces() {
        selectedMap = appSettings.getString("map", "Streets");
        if (selectedMap==="Streets") {
            map.setMapStyle(mapbox.MapStyle.STREETS);
        } else if (selectedMap==="Light") {
            map.setMapStyle(mapbox.MapStyle.LIGHT);
        }  else if (selectedMap==="Dark") {
            map.setMapStyle(mapbox.MapStyle.DARK);
        } else if (selectedMap==="Satellite") {
            map.setMapStyle(mapbox.MapStyle.SATELLITE);
        }  else if (selectedMap==="Hybrid") {
            map.setMapStyle(mapbox.MapStyle.HYBRID);
        }

        map.setZoomLevel(
            {
                level: 8, // 14 is aprox. .5mi
                animated: true // default true
            }
        )
        //Read airspaces based on the current country
        //Gets country from weather underground
        geoweather = "https://api.wunderground.com/api/"+WU_KEY+"/conditions/q/"+originLat+","+originLon+".json"
        //console.log(geoweather)
        fetchModule.fetch(geoweather, {
            method: "GET"
        })
        .then(function(response) {
            //alert({title: "GET Response", message: JSON.stringify(response), okButtonText: "Close"});
            var m = JSON.parse(response._bodyInit)
            originCountry = m.current_observation.display_location.country.toLowerCase()
            //originCountry = "at"
            console.log("******* Starting loading for country "+originCountry)
               
            var d = new Date(Date.now())
            var lastImport = formatDate(d);
     
            //loop database
            console.log("Starting query "+lastImport)
            var air_color
            var air_stroke_color
            var air_stroke_width = 2
            var air_opacity = .5

            //Verify first if originCountry exists in SQLite
            //YES: read from there
            //NO: Import from Firebase
            console.log("Searching SQLite for "+originCountry)
            var localair = 0 //0 means does not exist in the database yet
            var localversion
            db.get('SELECT lastImport FROM airspace_import WHERE air_country=?', [originCountry], function(err, row) {
                console.log("Row of data was: ", row);  // Prints [["Field1", "Field2",...]]
                if (row!=null) {
                    localair = 1;
                    localversion = row;
                }   
            });

            //Used to load local data
            if (localair==1) {
                console.log("Loading local data.")
                hasAirspace = true;
                //load local data
                db.all('SELECT * FROM airspaces WHERE country=?', [originCountry], function(err, loadedData) {
                    for (var i=0;i<loadedData.length;i++) {
                        //console.log(" geometry: "+loadedData[i][10])
                        var arr = JSON.parse(loadedData[i][10])
                        //console.log("Airport ("+i+"): "+loadedData[i][2]+" geometry: "+arr.length);
                        //console.log("lat: "+JSON.stringify(arr[0])+" lon: "+arr[0]);

                        var geo_process = arr.split(",");
                        var a_locations = []

                        for (g = 0; g < geo_process.length; g++) {
                            var geopoints = geo_process[g].split(" ");
                            var lat = Number(geopoints[2].split(" "));
                            var long = Number(geopoints[1].split(" "))
                            a_locations.push({lat:lat, lng:long})
                        }


                        //check if it is under 31mi/50km
                        var distKm = getDistanceFromLatLonInKm(a_locations[0].lat,a_locations[0].lng,originLat,originLon);
                        air_class = loadedData[i][3];
                        air_id = loadedData[i][11];
                        if (distKm<60) {
                            if (air_class=="D") { //blue
                                air_color = '#277BB8'
                                air_stroke_color = '#277BB8'
                                air_stroke_width = 3
                                //fillColor: '#10FF0000',
                                //strokeColor: '#FF0000',
                            } else if (air_class=="C") {  //magenta
                                air_color = '#B100FF'
                                air_stroke_color = '#B100FF'
                                air_stroke_width = 3
                            } else if (air_class=="E") {  //other shade of magenta
                                air_color = '#FF00FF'
                                air_stroke_color = '#FF00FF'
                            } else if (air_class=="A" || air_class=="B") {  //other shade of blue
                                air_color = '#0000FF'
                                air_stroke_color = '#0000FF'
                            } else if (air_class=="RESTRICTED") {  //red
                                air_color = '#FF0000'
                                air_stroke_color = '#FF0000'
                                air_opacity = 1
                                air_stroke_width = 3
                            } else if (air_class=="DANGER") {  //other shade of red
                                air_color = '#AD2222'
                                air_stroke_color = '#AD2222'
                                air_opacity = 1
                                air_stroke_width = 3
                            } else if (air_class=="PROHIBITED") {  //other shade of red - purple
                                    air_color = '#3D0064'
                                    air_stroke_color = '#3D0064'
                                    air_opacity = 1
                                    air_stroke_width = 3
                            } else  {  //yellow
                                air_color = '#E3C72A'
                                air_stroke_color = '#E3C72A'
                                console.log("Airspace "+air_id+" has a not specified class "+air_class)
                            }
/*
                            map.addPolyline({
                                id: air_id,
                                color: air_stroke_color,
                                width: air_stroke_width, //Set the width of the line (default 5)
                                opacity: air_opacity,
                                points: a_locations
                            })
*/

                            map.addPolygon({
                                id: air_id,
                                fillColor: air_color,
                                fillOpacity: .25, //075,
                                strokeColor: air_stroke_color,
                                strokeWidth: 1,
                                points: a_locations
                            })

                            closeAirspaces.push({
                                    id: air_id,
                                    name: loadedData[i][2],
                                    class: air_class,
                                    altBotRef: loadedData[i][4],
                                    altBotText: loadedData[i][5],
                                    altBotUnit: loadedData[i][6],
                                    altTopRef: loadedData[i][7],
                                    altTopText: loadedData[i][8],
                                    altTopUnit: loadedData[i][9],
                                    altLat: a_locations[0].lat,
                                    altLng: a_locations[0].lng,
                                    geometry: a_locations
                            })

                        } //ends distkm
                    } //ends FOR
                    var d = new Date(Date.now())
                    var lastImport = formatDate(d);
                    console.log("Finished loading data "+lastImport+". Imported airspaces: "+closeAirspaces.length)
                }); //ends function

                //check for updated data
                console.log("Already loaded local airspace. Check if version "+localversion+" is the latest.")
                var onQueryEvent = function(result) {
                    if (!result.error && result.value!=null) {                       
                        air_lastImport = result.value["lastImport"]
                        air_version = result.value["version"]
                        console.log("Latest version on FB: "+air_lastImport)
                        if (air_lastImport!=localversion) {
                            console.log("There is an updated version on FB. Update database for the future!")
                            updateAirspaces(air_version, air_lastImport);
                            /*
                            db.execSQL("DELETE FROM airspace_import WHERE air_country=?", [originCountry], function(err, id) {
                                console.log("Cleaned up previous airspace import from "+originCountry+" err: "+err);
                            });
                            */
                        } else {
                            console.log("You are using the latest version of the airspaces database.")
                        }
                    }
                }
                firebase.query(
                    onQueryEvent,
                    "/airspaces/"+originCountry, //+"/lastImport",
                    {
                        singleEvent: true,
                        orderBy: {
                            type: firebase.QueryOrderByType.KEY
                        }
                    }
                ); 
            } //end IF

            //Used to load NEW countries AND to update old local data
            console.log("LOCALAIR: "+localair)
            if (localair==0) {
                //check if country exists in Firebase
                var onQueryEvent = function(result) {
                    console.log("RESULT EM LOCALAIR 0: "+result)
                    if (!result.error && result.value!=null) {     
                        //var dx = JSON.stringify(result.value); console.log(dx)
                        console.log("Will read Firebase and import data.")
                        air_lastImport = result.value["lastImport"]
                        air_version = result.value["version"]
                        updateAirspaces(air_version, air_lastImport);
                    } else {
                        console.log("No country "+originCountry+" was found in the databases.")
                    }; //end if onQuery
                } //end onQuery
                firebase.query(
                    onQueryEvent,
                    "/airspaces/"+originCountry,
                    {
                        singleEvent: true,
                        orderBy: {
                            type: firebase.QueryOrderByType.KEY
                        }
                    }
                );
                
            }

        }, function(error) {
            console.log(JSON.stringify(error));
        })
//} //if beta
        

//}, 7000);

} 


function updateAirspaces(air_version, air_lastImport) {
    console.log("origin country in updateAirspaces: "+originCountry.toUpperCase())
    console.log("air_version: "+air_version+"- air_lastImport: "+ air_lastImport)
    dialogs.confirm({
        title: L('airspace_up_title',originCountry.toUpperCase()),
        message: L('airspace_up_msg'),
        okButtonText: L('yes'),
        cancelButtonText: L('no')
    }).then(function (result) {
        if (result) { 
            console.log("Will download new data now...")
            feedback.show({
                title: L('airspace_feed_title'),
                titleColor: new color.Color("#000000"),
                position: FeedbackPosition.Top, // iOS only
                type: FeedbackType.Custom, // this is the default type, by the way
                message: L('airspace_feed_msg'),
                messageColor: new color.Color("#000000"),
                duration: 500000,
                backgroundColor: new color.Color("#FFB100")
            });
            
            //loader.show({message: ""} );

            //Delete previous data
            if (db!=null) {
                db.execSQL("DELETE FROM airspaces WHERE country=?", [originCountry], function(err, id) {
                    console.log("Cleaned up previous airspaces from "+originCountry+" err: "+err);
                });
                db.execSQL("DELETE FROM airspace_import WHERE air_country=?", [originCountry], function(err, id) {
                    console.log("Cleaned up previous airspace import from "+originCountry+" err: "+err);
                });
            }

            //download file from FB Storage
            var tempplace = fs.knownFolders.temp();
            //var tempplace = fs.knownFolders.documents();
            var temppath = tempplace.path + "/"+originCountry+".json";
            console.log("salvando em "+temppath)

            // now download the file with either of the options below:
            firebase.storage.downloadFile({
                // the full path of an existing file in your Firebase storage
                remoteFullPath: 'airspaces/'+originCountry+'.json',
                // option 1: a file-system module File object
                localFullPath: temppath
            }).then(
                function (downloadedFile) {
                    console.log("File downloaded to the requested location - initializing the import process");
                    //Process json and save to SQLite
                    var jsonFile
                    var jsonData

                    jsonFile = tempplace.getFile(originCountry+".json");


                    jsonFile.readText()
                    .then(function (content) {
                        try {
                            jsonData = JSON.parse(content);
                            var totAirspaces = jsonData.OPENAIP.AIRSPACES.ASP.length
                            console.log("Airspaces to load: "+totAirspaces)

                            for (i = 0; i < totAirspaces; i++) { 
                                var a_version = jsonData.OPENAIP.AIRSPACES.ASP[i].VERSION
        
                                var a_id = jsonData.OPENAIP.AIRSPACES.ASP[i].ID;
                                var a_name = jsonData.OPENAIP.AIRSPACES.ASP[i].NAME
                                var a_altTopUnit = jsonData.OPENAIP.AIRSPACES.ASP[i].ALTLIMIT_TOP.ALT._UNIT
                                var a_altTopText = jsonData.OPENAIP.AIRSPACES.ASP[i].ALTLIMIT_TOP.ALT.__text
                                var a_altTopReference = jsonData.OPENAIP.AIRSPACES.ASP[i].ALTLIMIT_TOP._REFERENCE
                                var a_altBottomUnit = jsonData.OPENAIP.AIRSPACES.ASP[i].ALTLIMIT_BOTTOM.ALT._UNIT
                                var a_altBottomText = jsonData.OPENAIP.AIRSPACES.ASP[i].ALTLIMIT_BOTTOM.ALT.__text
                                var a_altBottomReference = jsonData.OPENAIP.AIRSPACES.ASP[i].ALTLIMIT_BOTTOM._REFERENCE
                                var a_geometry = " "+jsonData.OPENAIP.AIRSPACES.ASP[i].GEOMETRY.POLYGON
                                var a_category = jsonData.OPENAIP.AIRSPACES.ASP[i]._CATEGORY
                                var air_geometry2 = JSON.stringify(a_geometry)

                                //CHECK BELOW IF IT IS NEEDED
                                //Loops geometry
                                var geo_process = a_geometry.split(",");
                                console.log("("+i+") AIRPORT: "+a_id+" "+a_name+" ("+geo_process.length+"):  "); //+air_geometry2)
                                //console.log("Importing airspace ("+i+"): "+jsonData.OPENAIP.AIRSPACES.ASP[i].ID+" "+jsonData.OPENAIP.AIRSPACES.ASP[i].NAME+" #points: "+geo_process.length);
                                var a_locations = []

                                for (g = 0; g < geo_process.length; g++) {
                                    var geopoints = geo_process[g].split(" ");
                                    var lat = Number(geopoints[2].split(" "));
                                    var long = Number(geopoints[1].split(" "))
                                    //console.log("** Airspace: "+jsonData.OPENAIP.AIRSPACES.ASP[i].ID+" "+jsonData.OPENAIP.AIRSPACES.ASP[i].NAME+" points: "+geopoints[1].split(" ")+", "+geopoints[2].split(" "));
                                    //console.log(g)
                                    a_locations.push({lat:lat, lng:long})
                                }
                                //CHECK ABOVE IF IT IS NEEDED
                                //Records into SQLite 
                                if (db!=null) {
                                    db.execSQL('INSERT INTO airspaces (air_id, country, name, category, altBottomReference, altBottomText, altBottomUnit, altTopReference, altTopText, altTopUnit, geometry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [Number(a_id), originCountry, a_name, a_category, a_altBottomReference, a_altBottomText, a_altBottomUnit, a_altTopReference, a_altTopText, a_altTopUnit, air_geometry2], function(err, id) {
                                        //console.log("INSERT RESULT", id);
                                    }, error => {
                                        console.log("INSERT ERROR", err);
                                    })
                                }
                            
                                //Draw polylines if airspace is in the range
                                if (a_category=="D") { //blue
                                    air_color = '#277BB8'
                                    air_stroke_color = '#277BB8'
                                    air_stroke_width = 3
                                    //fillColor: '#10FF0000',
                                    //strokeColor: '#FF0000',
                                } else if (a_category=="C") {  //magenta
                                    air_color = '#B100FF'
                                    air_stroke_color = '#B100FF'
                                    air_stroke_width = 3
                                } else if (a_category=="E") {  //other shade of magenta
                                    air_color = '#FF00FF'
                                    air_stroke_color = '#FF00FF'
                                } else if (a_category=="A" || a_category=="B") {  //other shade of blue
                                    air_color = '#0000FF'
                                    air_stroke_color = '#0000FF'
                                } else if (a_category=="RESTRICTED") {  //red
                                    air_color = '#FF0000'
                                    air_stroke_color = '#FF0000'
                                    air_opacity = 1
                                    air_stroke_width = 3
                                } else if (a_category=="DANGER") {  //other shade of red
                                    air_color = '#AD2222'
                                    air_stroke_color = '#AD2222'
                                    air_opacity = 1
                                    air_stroke_width = 3
                                } else if (a_category=="PROHIBITED") {  //other shade of red - purple
                                        air_color = '#3D0064'
                                        air_stroke_color = '#3D0064'
                                        air_opacity = 1
                                        air_stroke_width = 3
                                } else  {  //yellow
                                    air_color = '#E3C72A'
                                    air_stroke_color = '#E3C72A'
                                    //console.log("Airspace "+air_id+" has a not specified class "+air_class)
                                }

                                //check if it is under 31mi/50km
                                var distKm = getDistanceFromLatLonInKm(a_locations[0].lat,a_locations[0].lng,originLat,originLon);
                                if (distKm<60) {
/*
                                    map.addPolyline({
                                        id: a_id,
                                        color: air_stroke_color,
                                        width: air_stroke_width, //Set the width of the line (default 5)
                                        opacity: air_opacity,
                                        points: a_locations
                                    })
*/

                                    map.addPolygon({
                                        id: a_id,
                                        fillColor: air_color,
                                        fillOpacity: .25,
                                        strokeColor: air_stroke_color,
                                        strokeWidth: 1,
                                        points: a_locations
                                    })


                                    closeAirspaces.push({   
                                            id: a_id,
                                            name: a_name,
                                            class: a_category,
                                            altBotRef: a_altBottomReference,
                                            altBotText: a_altBottomText,
                                            altBotUnit: a_altBottomUnit,
                                            altTopRef: a_altTopReference,
                                            altTopText: a_altTopText,
                                            altTopUnit: a_altTopUnit,
                                            geometry: a_locations
                                    })
                                }    
                       
                            } //ends totAirspaces FOR

                            hasAirspace = true; 
                            if (air_lastImport==""|| air_lastImport==undefined || air_lastImport==null) {
                                var d = new Date(Date.now())
                                air_lastImport = formatDateAirspace(d);
                                air_version = a_version
                            }
                            if (db!=null) {
                                //update airspaces_import database with latest info
                                db.execSQL('INSERT INTO airspace_import (air_country, version, lastImport) VALUES (?, ?, ?)', [originCountry, air_version, air_lastImport], function(err, id) {
                                    console.log("Updated airspace_import: "+originCountry+" err: "+err);  // Prints [["Field1", "Field2",...]]
                                });
                            }
                            console.log("Finished loading data ")
                            feedback.hide();
                            
        
                        } catch (err) {
                            console.log('Could not parse JSON file')
                            throw new Error('Could not parse JSON file');
                        }
                    }, function (error) {
                        console.log('Could not read JSON file')
                        throw new Error('Could not read JSON file');
                    });
                },
                function (error) {
                    console.log("File download error: " + error);
                }

            ); //end downloadFile function
        }; //ends IF result
    }); //finish alert stop flight
    return;
}



//Point on Polygons
function checkAirspace(curLat, curLon, airspaces) {
    var i, j=airspaces.length-1 ;
    var  oddNodes=false;
    var msg

    var polyX = airspaces; //cornersX; //closeAirspaces[0]["geometry"][0].lng
    var polyY = airspaces; //cornersY; //airspaces

    for (i=0; i<airspaces.length; i++) {
        if ((polyY[i].lng< curLon && polyY[j].lng>=curLon ||  polyY[j].lng< curLon && polyY[i].lng>=curLon) &&  (polyX[i].lat<=curLat || polyX[j].lat<=curLat)) {
          oddNodes^=(polyX[i].lat+(curLon-polyY[i].lng)/(polyY[j].lng-polyY[i].lng)*(polyX[j].lat-polyX[i].lat)<curLat); 
        }
        j=i; 
    }

      return oddNodes;
}


//Check if current position is inside an airspace and show message
var airspaceMaxName
var airspaceMaxClass
var showMsg = 0
var airspaceMin = 10000;
var airspaceMax = 10000 //max flyable for PPG
var airspaceFt = "F"

var msg = "";
var msgTitle = "";
var previousMsg = "";
var airspaceAlert
setInterval(function() {
    //console.log("Checking airspaces. # airspaces around: "+closeAirspaces.length)
    
    if (isFlying && hasAirspace && closeAirspaces.length > 0) { 

        for (i=0; i<closeAirspaces.length; i++) {
            if (checkAirspace(curLat, curLon, closeAirspaces[i]["geometry"])) {
                //console.log("Dentro do airspace ("+closeAirspaces[i]["id"]+") "+closeAirspaces[i]["name"]+" max altitude: "+closeAirspaces[i]["altBotText"])
                if (closeAirspaces[i]["altBotText"]<airspaceMax) {
                    airspaceMax = closeAirspaces[i]["altBotText"]
                    airspaceMaxName = closeAirspaces[i]["name"]
                    airspaceMaxClass = closeAirspaces[i]["class"]
                    airspaceMin = closeAirspaces[i]["altTopText"]
                    airspaceFt = closeAirspaces[i]["altBotUnit"]
                    if (airspaceFt!="F") {
                        airspaceFt = "mt"
                        airspaceMax = (Number(airspaceMax)*0.3048).parseInt
                    } else {
                        airspaceFt = "ft"
                    }
                }
                showMsg = showMsg + 1
                
            } else {
                //console.log("fora do polygon")
                //console.log("Fora do airspace."+closeAirspaces[i]["name"])
                /*
                feedback.info({
                    title: "GOOD TO GO!", 
                    message: "",
                    duration: 1
                });
                showMsg = false
                */
            }
        }
        //console.log("showMessage: "+showMsg)
        //show message
        if (showMsg>0) {
            if (airspaceMaxClass=="A" || airspaceMaxClass=="B" || airspaceMaxClass=="C" || airspaceMaxClass=="D") {
                //msg = "CLASS "+ airspaceMaxClass +" airspace ("+airspaceMaxName+") requires permission to fly. "
                msg = L('airspace_class')+" "+ airspaceMaxClass +" "+L('airspace')+airspaceMaxName+L('airspace_permission')
                if (Number(airspaceMax)==0) {
                    msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt+L('airspace_leave')
                } else {
                    msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt+" "+L('airspace_low')
                }
            } else if (airspaceMaxClass=="RESTRICTED" || airspaceMaxClass=="DANGER") {
                if (airspaceMaxClass=="RESTRICTED") {
                    msg = L('airspace_restricted')+" "+L('airspace')+airspaceMaxName+L('airspace_avoid')
                } else {
                    msg = L('airspace_danger')+" "+L('airspace')+airspaceMaxName+L('airspace_avoid')
                }
                msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt+" "+L('airspace_low')
            }  else if (airspaceMaxClass=="PROHIBITED") {
                msg = L('airspace_prohibited') +L('airspace')+airspaceMaxName+L('airspace_mustAvoid')
                msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt+L('airspace_leave')
            }  else if (airspaceMaxClass=="E") {
                msg = L('airspace_class')+" "+ airspaceMaxClass +" "+L('airspace')+airspaceMaxName+L('airspace_safe')
                msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt+L('airspace_low')
            } else {
                msg = L('airspace_class')+" "+ airspaceMaxClass +" "+L('airspace')+airspaceMaxName+L('airspace_unknown')
                msgTitle = L('airspace_max')+" "+airspaceMax+airspaceFt+L('airspace_low')
            }
            if (msgTitle!=previousMsg) {
                feedback.info({
                    title: msgTitle, 
                    message: msg,
                    duration: 100000
                });
            }
            var speakOptions = {
                text: msgTitle+msg,
                speakRate: 0.5,
                pitch: 1.0,
                volume: 1.0
            };
            if (voiceAlert=="true") {
                TTS.speak(speakOptions) //cross wind
                console.log("4046")
            }
            
           // previousMsg = msgTitle
            
        } else if (previousMsg!=msgTitle) {
            feedback.info({
                title: "GOOD TO GO!", 
                message: "",
                duration: 0
            });
            
        }
        showMsg = 0
        previousMsg = msgTitle
    }

}, 15000);


function formatDateAirspace(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var secs = date.getSeconds();
    var ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;

    var months = ["Jan","Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    var data = date.getDate() + "/"+ months[date.getMonth()] + "/" + date.getFullYear();
    var strTime = data + " "+ hours + ':' + minutes + ':' + secs; //ampm;
    return strTime;
}

/* ACCELEROMETER ATTITUDE INDICATOR
//2.5 Accelerometer
var accelerometer = require("nativescript-accelerometer-advanced");
var attitudeIcon
var orientation = require('nativescript-orientation');
setTimeout(function() {
//Accelerometer test - accelerometer did not work with Android
console.log("Accelerometer: "+accelerometer)
console.log(orientation.getOrientation());

if (accelerometer.startAccelerometerUpdates!=null) { console.log("existe accelerometer")} else {console.log("nao existe accelerometer")}
    accelerometer.startAccelerometerUpdates(function(data) {
       // console.log(" X: " + data.x + " Y: " + data.y + " Z: " + data.z + " Sensor Type: " + data.sensortype + " Time in milliseconds : " + data.timemilli);
        //console.log(parseInt(data.x * 100))
        if (orientation.getOrientation()=="landscape") { 
            attitudeIcon.animate({
                rotate: ( parseInt(data.y * -100) ) 
            });
        } else {
            attitudeIcon.animate({
                rotate: parseInt(data.x * 100)
            });
        }
    }, { sensorDelay: "normal" }); //normal, ui, game, fastest

}, 10000);
*/

//2.5 GoPro functions
var httpModule = require("http")
var cameraAlertOn = true
var cameraSetTime = true
function getCameraSettings(args) {
    console.log("em getCameraSettings: "+fbCamera)
    switch(fbCamera) {
        case "goPro":
            console.log("Getting goPro camera settings!")
            httpModule.getJSON("http://10.5.5.9/gp/gpControl/status").then(function (r) {
                //// Argument (r) is JSON!
                console.log("Camera connection response: "+JSON.stringify(r))
                cameraOn = true
                cameraBattery = r["status"]["2"]
                cameraSDCard = r["status"]["33"]
                cameraRecording = r["status"]["8"] //0 not recording, 1 recording
                cameraSDSize = r["status"]["54"] //available space in bytes
                cameraLCD = r["status"]["58"] //0 is OFF, 1 is ON (could be 72 in newer cameras)

                cameraControl.src="res://gopro_on"
                
                console.log("Camera LCD: "+cameraLCD)
                console.log("Battery: "+cameraBattery)
                console.log("SD card: "+cameraSDCard)
                console.log("Recording? "+cameraRecording)
                console.log("SD Available space? "+cameraSDSize)
                console.log("Remaining video time: "+r["status"]["35"])
                console.log("Current mode: "+r["status"]["43"])

                //Forces video mode
                if (r["status"]["43"]!=0) { //0 is video, 1 is photo, 2 is multishot
                    httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/mode?p=0").then(function (r) {
                        console.log("Set camera to video mode!")
                    }, function (e) {
                        console.log("Camera set to video mode error: "+(e));
                    }); 
                }
   
                //Only shows dialog if cameraAlertOn is true
                if (cameraAlertOn) {
                    if (cameraBattery==1 && cameraSDCard !=2) {
                        //alert("Your camera battery is low.")
                        dialogs.confirm({
                            title: L('camera_attentionTitle'),
                            message: L('camera_attention_batteryLow'),
                            okButtonText: L('OK'),
                            cancelButtonText: L('camera_attention_turnOFF')
                        }).then(function (resulta) {
                            if(!resulta) {
                                cameraOFF()
                            }
                        })
                    } else if (cameraBattery==1 && cameraSDCard==2) {
                        //alert("Your battery is low and there is no sd card in your camera.")
                        dialogs.confirm({
                            title: L('camera_attentionTitle'),
                            message: L('camera_attention_batterySD'),
                            okButtonText: L('OK'),
                            cancelButtonText: L('camera_attention_turnOFF')
                        }).then(function (resulta) {
                            if(!resulta) {
                                cameraOFF()
                            }
                        })
                        
                    } else if (cameraBattery==0) {
                        //alert("Your camera battery is empty.")
                        dialogs.confirm({
                            title: L('camera_attentionTitle'),
                            message: L('camera_attention_batteryEmpty'),
                            okButtonText: L('OK'),
                            cancelButtonText: L('camera_attention_turnOFF')
                        }).then(function (resulta) {
                            if(!resulta) {
                                cameraOFF()
                            }
                        })
                    } else if (cameraSDCard==2) {
                        //alert("There is no sd card in your camera.")
                        dialogs.confirm({
                            title: L('camera_attentionTitle'),
                            message: L('camera_attention_noSD'),
                            okButtonText: L('OK'),
                            cancelButtonText: L('camera_attention_turnOFF')
                        }).then(function (resulta) {
                            if(!resulta) {
                                cameraOFF()
                            }
                        })
                    } else if (cameraRecording) {
                        cameraControl.src="res://gopro_recording"
                    } 
                }
                

                //Only do it once
                if (cameraSetTime) {
                    //sync date/time
                    var ct = new Date() 
                    var ct_day = ct.getDate()
                    var ct_month = ct.getMonth() + 1
                    var ct_year = Number(String(ct.getFullYear()).substr(2, 2))
                    var ct_hour = ct.getHours() 
                    var ct_minute = ct.getMinutes()
                    var ct_second = ct.getSeconds() 
                    console.log(ct_day+"/"+ct_month+"/"+ct_year+" - "+ct_hour+":"+ct_minute+":"+ct_second)
                    //convert to Hex
                    //hexString = yourNumber.toString(16);            
                    //yourNumber = parseInt(hexString, 16);
                    var ct_dayh = ct.getDate().toString(16)
                    if(ct_dayh.length==1) {ct_dayh="0"+ct_dayh}
                    var ct_monthh = (ct.getMonth() + 1).toString(16)
                    if(ct_monthh.length==1) {ct_monthh="0"+ct_monthh}
                    var ct_yearh = Number(String(ct.getFullYear()).substr(2, 2))
                    if(ct_yearh.length==1) {ct_yearh="0"+ct_yearh}
                    var ct_hourh = ct.getHours().toString(16) 
                    if(ct_hourh.length==1) {ct_hourh="0"+ct_hourh}
                    var ct_minuteh = ct.getMinutes().toString(16)
                    if(ct_minuteh.length==1) {ct_minuteh="0"+ct_minuteh}
                    var ct_secondh = ct.getSeconds().toString(16) 
                    if(ct_secondh.length==1) {ct_secondh="0"+ct_secondh}
                    //console.log(ct_day+"/"+ct_month+"/"+ct_year+" - "+ct_hour+":"+ct_minute+":"+ct_second)
                    var ct_hex = "%"+ct_yearh+"%"+ct_monthh+"%"+ct_dayh+"%"+ct_hourh+"%"+ct_minuteh+"%"+ct_secondh
                    // result: 10/4/18 - 10:34:36 %18%4%0a%10%34%36
                    httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/setup/date_time?p="+ct_hex).then(function (r) {
                        console.log("Updated camera date and time!")
                        cameraSetTime = false
                    }, function (e) {
                        console.log("Camera date/time sync error: "+(e));
                    });   
                }
            }, function (e) {
                //// Argument (e) is Error!
                //console.log(e);
                console.log("en error:  fbCamera: "+fbCamera)
                cameraOn = false
                //this is the opportunity to try to activate the camera first
                if (cameraAlertOn && fbCamera=="goPro") {
                    //alert("Your camera battery is low.")
                    dialogs.confirm({
                        title: L('camera_attentionTitle'),
                        message: L('camera_attention_cameraOFF'),
                        okButtonText: L('OK'),
                        cancelButtonText: L('do_not_show_again'),
                        neutralButtonText: L('camera_attention_tryAgain')
                    }).then(function (resulta) {
                        console.log("Resulta: "+resulta)
                        if(resulta==false) {
                            cameraAlertOn = false
                            getCameraSettings() //continously run to visually inform user if camera got disconnected
                        } else if (resulta==undefined) {
                            console.log("Try again!")
                            getCameraSettings()
                        }
                    })
                }
                console.log("Camera connection error: "+(e));
                //try to force cameraSTART (WoL)
                cameraPowerOn()
            });

            break;
        default:
            console.log("Testando se tem camera: "+cameraControl+" - "+fbCamera)
            console.log("No camera!!!")
            //remove icon from screen
            if (cameraControl!=null && fbCamera=="") {
                cameraControl.style.marginBottom = 5000;
            } 
    }


}

//camera OFF
//fbCamera = ""
function cameraOFF(args) {
    switch(fbCamera) {
        case "goPro":
            console.log("goPro camera stopping recording!")
            //Check if camera is not recording first
            if (cameraRecording) {
                // stop and save it first
                httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/shutter?p=0").then(function (r) {
                    cameraRecording = 0
                    httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/system/sleep").then(function (r) {
                        console.log("Camera turn off response: "+JSON.stringify(r))
                        cameraOn = false
                        cameraControl.src="res://gopro_off"
                    }, function (e) {
                        //cameraOn = true
                        console.log("Camera turn off error: "+(e));
                    });
                }, function (e) {
                    cameraRecording = 0
                    console.log("Camera stop recording error: "+(e));
                });
            } else {
                //Turn wifi OFF (not work on new Hero??)
                httpModule.getJSON("http://10.5.5.9/gp/gpControl/setting/63/0").then(function (r) {
                    console.log("Camera wifi off response: "+JSON.stringify(r))
                }, function (e) {
                    console.log("Camera wifi off error: "+(e));
                });

                //Turn off the camera
                httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/system/sleep").then(function (r) {
                    console.log("Camera turn off response: "+JSON.stringify(r))
                    cameraOn = false
                    cameraControl.src="res://gopro_off"
                }, function (e) {
                    //cameraOn = true
                    console.log("Camera turn off error: "+(e));
                });

            }
   

            break;
        default:
            console.log("No camera!!!")
    }
}

//tag moment
function cameraSnapshot(args) {
    switch(fbCamera) {
        case "goPro":
            console.log("goPro camera snapshot/moment!")
            if (cameraOn && cameraRecording) {
                httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/storage/tag_moment").then(function (r) {
                    console.log("Camera took a snapshot/moment: "+JSON.stringify(r))
                }, function (e) {
                    console.log("Camera did not take a snapshot/moment error: "+(e));
                });
            } else if (cameraOn && !cameraRecording) {
                cameraREC()
            }
            break;
        default:
            console.log("No camera!!!")
    }
}

//camera Power ON
function cameraPowerOn(args) {
    switch(fbCamera) {
        case "goPro":
            console.log("goPro camera powering on!")
            //Wake on Lan
            /*Power On: To power ON a HERO4 Black/Silver camera, use WoL with these parameters: MAC ADDRESS OF THE CAMERA, 
            10.5.5.9 as IP ADDRESS, Subnet Mask 255.255.255.0, Port 9. 
            For the Hero4 Session, this magic packet has to be sent when your project wants to operate with the camera.
            */


            break;
        default:
            console.log("No camera!!!")
    }
}

//camera Recording
function cameraREC(args) {
    switch(fbCamera) {
        case "goPro":
            console.log("goPro camera is recording!")
            //Check if camera is on first
            if (cameraOn) {
                httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/shutter?p=1").then(function (r) {
                    cameraRecording = 1
                    cameraControl.src="res://gopro_recording"
                    console.log("RECORDING ATIVADO!!!")
                }, function (e) {
                    cameraRecording = 0
                    cameraControl.src="res://gopro_on"
                    console.log("Camera is not recording error: "+(e));
                });
            } else {
                //try to activate the camera
                cameraPowerOn()
            }
            break;
        default:
            console.log("No camera!!!")
    }
}

//Control camera icon
function onGoPro() {
    console.log("clicou gopro icon")
    if (cameraRecording) {
        //set cameraRecording to false
        httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/shutter?p=0").then(function (r) {
            cameraRecording = 0
            //change icon to blue
            cameraControl.src="res://gopro_on"
        }, function (e) {
            console.log("Camera pause recording error: "+(e));
        });
        
    } else {
        httpModule.getJSON("http://10.5.5.9/gp/gpControl/command/shutter?p=1").then(function (r) {
            cameraRecording = 1
            //change icon to red
            cameraControl.src="res://gopro_recording"
        }, function (e) {
            console.log("Camera recording error: "+(e));
        });
    }
};
exports.onGoPro = onGoPro

//runs when app starts
setTimeout(function() {
    console.log("CAMERA? "+fbCamera)
    if(fbCamera!="" && !cameraOn) {
        cameraPowerOn()
    }
    getCameraSettings()  
}, 3000);


//running every minute
setInterval(function() {
    if (fbCamera!="") {
        getCameraSettings()
    }   
}, 60000); //5 min = 300000