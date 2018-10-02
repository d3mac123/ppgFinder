//FLIGHT DETAIL
/* Lists all flights */
var gestures = require("ui/gestures"); //for the keyboard

//Common libraries
var frames = require("ui/frame");
var dialogs = require("ui/dialogs");
var fetchModule = require("fetch");

var mapbox = require("nativescript-mapbox");
var map
var appSettings = require("application-settings");
var view = require("ui/core/view");

var observable = require("data/observable");
var observableArray = require("data/observable-array");

var pageModule = require("ui/page");
var firebase = require("nativescript-plugin-firebase");

var Sqlite = require( "nativescript-sqlite" );
var db_name = "ppgfinder.db"
var db = null;
new Sqlite(db_name).then(dbConnection => {
    db = dbConnection;
    console.log("Connected with DB.")
}, error => {
    console.log("NOT connected with DB.")
});


var flightData;

// Zeroes all variables
var fbMi
var fbSp
var fbFt
var fbUID = appSettings.getString("uid", "");

var fbMeasurement = appSettings.getString("system", "imperial");
if (fbMeasurement === "imperial") {
    fbMi = "mi";
    fbFt = "ft";
    fbSp = "mph";
} else {
    fbMi = "km";
    fbFt = "mt";
    fbSp = "kph";
}
var fid = appSettings.getString("fid", "");
var fbIcon = appSettings.getString("icon", "mk_red_green");
var fbCountry = appSettings.getString("country", "");

var fday
var ftime

var flightDurationHolder
var flightAltitudeHolder
var flightDistancenHolder
var flightSpeedHolder
var flightTime
var fPlace

var sliderAt = 0
var slider
var actionTitle

var page;

var norte
var sul 
var leste
var oeste
var flightData
var startFlight
var endFlight
var totDistance
var totDuration
var fmaxAltitude
var fmaxSpeed

var snapshots

var originCountry = fbCountry
console.log("fbCountry: "+fbCountry)

exports.pageLoaded = function(args) {
    page = args.object;
    actionTitle = page.getViewById("actionTitle");
    flightDurationHolder = page.getViewById("flightDurationHolder");
    flightAltitudeHolder = page.getViewById("flightAltitudeHolder");
    flightDistanceHolder = page.getViewById("flightDistanceHolder");
    flightSpeedHolder = page.getViewById("flightSpeedHolder");
    flightTime = page.getViewById("flightTime");
    startFlight = page.getViewById("startFlight");
    endFlight = page.getViewById("endFlight");

    fid = appSettings.getString("fid", "");

    //builds day name
    var d = new Date(Number(fid));
    //var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var days = [L('sunday'),L('monday'),L('tuesday'),L('wednesday'),L('thursday'),L('friday'),L('saturday')];

    var weekDay = days[d.getDay()];
    var day = d.getDate()
    if (day<10) {
        day = "0"+day
    }
    var month = d.getMonth() + 1
    if (month<10) {
        month = "0"+month
    }
    fday = weekDay + ", " + month + "/" + day

    var hour = d.getHours()
    var ampm = "AM";
    if (hour<10) {
        hour = "0"+hour
    }
    if (hour>12) {
        hour = hour - 12;
        ampm = "PM";
    }
    var minute = d.getMinutes()
    if (minute<10) {
        minute = "0"+minute
    }

    ftime = hour + ":" + minute + " " + ampm

    slider = page.getViewById("slider");

    //page.bindingContext = { sliderValue: sliderAt, flightPlace: fPlace, flightTitle:fday, flightTime: ftime} 
    
    
    var viewModel = new observable.Observable();
    viewModel.set('sliderValue', 0);
    viewModel.set('flightTitle', fPlace);
    page.bindingContext = viewModel;

    viewModel.on(observable.Observable.propertyChangeEvent, function(propertyChangeData){
        //mover icone para lat/lon do valor do slider
        map.removeMarkers(["Glider"]);
        map.addMarkers([
            {
                id: "Glider", // can be user in 'removeMarkers()'
                lat: flightData[parseInt(slider.value)].lat, // mandatory
                lng: flightData[parseInt(slider.value)].lng, // mandatory
                icon: 'res://' + fbIcon
            }
        ])

        //capture info and show
        calcRidingTime(flightData[0].date,flightData[parseInt(slider.value)].date)
        calcRidingDistance(parseInt(slider.value))
        if (fbMeasurement === "imperial") {
            flightAltitudeHolder.text =  (flightData[parseInt(slider.value)].altitude * 3.28084).toFixed(0) + fbFt; 
            flightSpeedHolder.text  =  (flightData[parseInt(slider.value)].speed / 0.447).toFixed(1) + fbSp;
        } else {
            flightAltitudeHolder.text =  flightData[parseInt(slider.value)].altitude.toFixed(0) + fbFt; 
            flightSpeedHolder.text  =  (flightData[parseInt(slider.value)].speed * 3.6).toFixed(1) + fbSp;
        }
    });

    
}

function pageNavigatedTo(args) {
    const page = args.object;
    const context = page.navigationContext;
    flightData = context.flightData
    fPlace = context.place
    norte = context.north
    leste = context.east
    sul = context.south
    oeste = context.west
    fmaxAltitude = context.maxAlt
    fmaxSpeed = context.maxSpeed
    snapshots = context.snaps
    console.log("******************** maxSpeed: "+fmaxSpeed+" maxAlt.: "+fmaxAltitude)
}

exports.pageNavigatedTo = pageNavigatedTo;

//Calculates total distance
var totalDistance = 0
var previousLoc = []
function calcRidingDistance(d){
    totalDistance = 0
    for(i=0;i<d;i++){
        if(i==0) {
            previousLoc=[{lat: flightData[0].lat, lng: flightData[0].lng}]
        }
        totalDistance = totalDistance + getDistanceFromLatLonInKm(previousLoc[0].lat,previousLoc[0].lng,flightData[i].lat,flightData[i].lng) * 1000;
        previousLoc=[{lat: flightData[i].lat, lng: flightData[i].lng}]
    }
    
    //updates dash
    if (fbMeasurement === "imperial") {
        myDistance = Number(totalDistance * 0.000621371);
    } else {
        myDistance = Number(totalDistance/1000);
    }

    flightDistanceHolder.text = myDistance.toFixed(1) + fbMi;
}

//Buids listView
function loadList(args) {       
    slider.value = 0
    slider.maxValue = flightData.length-1

    startFlight.text = formatHour(flightData[0].date);
    endFlight.text = formatHour(flightData[flightData.length-1].date);

    flightDurationHolder.text =  "0:00h";
    flightDistanceHolder.text =  "0"+fbMi;
    if (fbMeasurement === "imperial") {
        flightAltitudeHolder.text =  (flightData[0].altitude * 3.28084).toFixed(0) + fbFt; 
        flightSpeedHolder.text  =  (flightData[0].speed / 0.447).toFixed(1) + fbSp;
    } else {
        flightAltitudeHolder.text =  flightData[0].altitude.toFixed(0) + fbFt; 
        flightSpeedHolder.text  =  (flightData[0].speed * 3.6).toFixed(1) + fbSp;
    }

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

    //Current implementation
    drawPoly();
          
    map.addMarkers([
        {
            id: "Origin", // can be user in 'removeMarkers()'
            lat: flightData[0].lat, // mandatory
            lng: flightData[0].lng, // mandatory
            title: L('markerStartTitle'), // no popup unless set
            subtitle: L('markerStartContent'),
            icon: 'res://ic_start_flight'
        }
    ])
    
    map.addMarkers([
        {
            id: "end_flight", // can be user in 'removeMarkers()'
            lat: flightData[flightData.length-1].lat, // mandatory
            lng: flightData[flightData.length-1].lng, // mandatory
            title: L('markerEndTitle'), // no popup unless set
            subtitle: L('markerEndContent'),
            icon: 'res://ic_end_flight'
        }
    ])

    var aa = fmaxAltitude; //maxalt
    var ab = 0; //maxalt with fb
    var bb = fmaxSpeed; //maxspeed
    var bc = 0; //maxspeed with fb
    for (x=0;x<flightData.length;x++) {    
        if(flightData[x].altitude > fmaxAltitude) {
            if (fbMeasurement === "imperial") {
                ab =  (fmaxAltitude * 3.28084).toFixed(0) + fbFt; 
            } else {
                ab =  fmaxAltitude.toFixed(0) + fbFt; 
            } 
            fmaxAltitude = flightData[x].altitude
            aa = x
        }
        if(parseInt(flightData[x].speed)==fmaxSpeed) { 
            if (fbMeasurement === "imperial") {
                bc =  (fmaxSpeed / 0.447).toFixed(1) + fbSp;
            } else { 
                bc =  (fmaxSpeed * 3.6).toFixed(1) + fbSp;
            }
            fmaxSpeed = flightData[x].speed
            bb = x
        }
    }
    //Max. altitude and speed icons
    //console.log(aa+", "+ab+" - "+flightData[aa].lat+", "+flightData[aa].lng)
    //map.removeMarkers(["maxAlt"]);
    map.addMarkers([
        {
            id: "maxAlt", // can be user in 'removeMarkers()'
            lat: flightData[aa].lat, // mandatory
            lng: flightData[aa].lng, // mandatory
            title: L('maxAltitude'), // no popup unless set
            subtitle: ab,
            icon: 'res://ic_max_alt'
        }
    ]) 
    //map.removeMarkers(["maxSpeed"]);
    map.addMarkers([
        {
            id: "maxSpeed", // can be user in 'removeMarkers()'
            lat: flightData[bb].lat, // mandatory
            lng: flightData[bb].lng, // mandatory
            title: L('maxSpeed'), // no popup unless set
            subtitle: bc,
            icon: 'res://ic_max_speed'
        }
    ])

    //Add glider marker in point[0]
    map.addMarkers([
        {
            id: "Glider", // can be user in 'removeMarkers()'
            lat: flightData[0].lat, // mandatory
            lng: flightData[0].lng, // mandatory
            icon: 'res://' + fbIcon
        }
    ])
    
    //Show snapshots if any
    console.log("fbUID: " + fbUID + ", fid: " + fid);
    if(snapshots!=undefined && snapshots.length>0) {
        for (s = 0; s < snapshots.length; s++) {
            console.log(s+" "+snapshots[s].info)
            var ms = s;
            var mid = "snap"+s;
            var mlat = snapshots[s].lat;
            var mlon = snapshots[s].lng;

            
            var dt2 = new Date(snapshots[s].date);
            var dt1 = new Date(flightData[0].date);
            var diff =(dt2.getTime() - dt1.getTime()) / 1000;
            var mmsg = L('snapshot_edit_msg',formatHour(snapshots[s].date)+" ("+twelveHourClock(diff)+")")
            //console.log("Hora inicio: "+flightData[0].date+" Hora do snap: "+snapshots[s].date+" diferença: "+twelveHourClock(diff))
            var mcontent = snapshots[s].info;

            map.addMarkers([
                {
                    id: mid, // can be user in 'removeMarkers()'
                    lat: mlat, // mandatory
                    lng: mlon, // mandatory
                    icon: 'res://ic_max_snapshot',
                    onTap: function(marker) { console.log("The callout of this marker "+marker["id"]+" was tapped");dialogs.prompt({
                        title: L('snapshot_edit_title'),
                        message: mmsg, //format date
                        okButtonText: L('save'),
                        cancelButtonText: L('cancel'),
                        defaultText: snapshots[marker["id"].substring(4,marker["id"].length)].info,
                        inputType: dialogs.inputType.text
                    }).then(function (r) {
                        //console.log("Salvar result: " + r.result + ", text: " + r.text);
                        //console.log("fbUID: " + fbUID + ", fid: " + fid + ", tapped: "+String(marker["id"].substring(4,marker["id"].length)));
                        //console.log('flights/'+fbUID+'/'+fid+'/snapshots/'+marker["id"].substring(4,marker["id"].length))
                        snapshots[marker["id"].substring(4,marker["id"].length)].info = r.text;
                        if(r.result) {
                            firebase.update(
                                'flights/'+fbUID+'/'+fid+'/snapshots/'+marker["id"].substring(4,marker["id"].length),
                                {
                                        "info":r.text
                                }
                            );
                        }
                    }) }
                }
            ])
        }
    }


    setTimeout(function() {
        loadAirspaces()            
    }, 3000);
 
}


var curMap = 0 //streets 1: satellite
exports.switchMap = function() {
        if (curMap) {
            map.setMapStyle(mapbox.MapStyle.STREETS);
            curMap = 0
        } else {
            map.setMapStyle(mapbox.MapStyle.SATELLITE);
            curMap = 1
        }
        
        setTimeout(function() {
            drawPoly()            
        }, 1000);
        setTimeout(function() {
            loadAirspaces()            
        }, 3000);
}

function drawPoly() {
    map.removePolylines()
    map.addPolyline({
        id: 1, // optional, can be used in 'removePolylines'
        color: '#30BCFF', // Set the color of the line (default black)
        width: 5, //Set the width of the line (default 5)
        points: JSON.parse(JSON.stringify(flightData))
    });
}

 
function onMapReady(args) {
    map = args.map;
    
      //args.map.setMapStyle(mapbox.MapStyle.DARK);  
        loadList();   
}
exports.onMapReady = onMapReady;

function formatHour(date) {
    var date = new Date(date)
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = "AM";
    if (hours>12) {
        hours = hours - 12;
        ampm = "PM";
    }
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0'+minutes : minutes;

    var strTime = hours + ':' + minutes + ampm
    return strTime;
}


function getCountry() {
    const WU_KEY= '20661ae8dffc9c30';
    var geoweather = "https://api.wunderground.com/api/"+WU_KEY+"/conditions/q/"+flightData[0].lat+","+flightData[0].lng+".json"
    //console.log(geoweather)
    fetchModule.fetch(geoweather, {
        method: "GET"
    })
    .then(function(response) {
        //alert({title: "GET Response", message: JSON.stringify(response), okButtonText: "Close"});
        var m = JSON.parse(response._bodyInit)
        originCountry = m.current_observation.display_location.country.toLowerCase()
        if (fbCountry=="") {
            //sets default country for future trips
            appSettings.setString("country", originCountry);
        }
        loadAirspaces()
    })
}
function loadAirspaces() {
    if (originCountry=="") {
        getCountry()
        return
    }
    //originCountry = "us"
    var air_color
    var air_stroke_color
    var air_stroke_width = 2
    var air_opacity = .5

    db.all('SELECT * FROM airspaces WHERE country=?', [originCountry], function(err, loadedData) {
        for (var i=0;i<loadedData.length;i++) {
            var arr = JSON.parse(loadedData[i][10])
            var geo_process = arr.split(",");
            var a_locations = []

            for (g = 0; g < geo_process.length; g++) {
                var geopoints = geo_process[g].split(" ");
                var lat = Number(geopoints[2].split(" "));
                var long = Number(geopoints[1].split(" "))
                a_locations.push({lat:lat, lng:long})
            }

            //check if it is under 31mi/50km
            var distKm = getDistanceFromLatLonInKm(a_locations[0].lat,a_locations[0].lng,flightData[0].lat,flightData[0].lng);
            air_class = loadedData[i][3];
            air_id = loadedData[i][11];

            if (distKm<60) {
                if (air_class=="D") { //blue
                    air_color = '#4B277BB8'
                    air_stroke_color = '#277BB8'
                    air_stroke_width = 3
                } else if (air_class=="C") {  //magenta
                    air_color = '#1EB100FF'
                    air_stroke_color = '#B100FF'
                    air_stroke_width = 3
                } else if (air_class=="E") {  //other shade of magenta
                    air_color = '#1EFF00FF'
                    air_stroke_color = '#FF00FF'
                } else if (air_class=="A" || air_class=="B") {  //other shade of blue
                    air_color = '#1E0000FF'
                    air_stroke_color = '#0000FF'
                } else if (air_class=="RESTRICTED") {  //red
                    air_color = '#1EFF0000'
                    air_stroke_color = '#FF0000'
                    air_opacity = 1
                    air_stroke_width = 3
                } else if (air_class=="DANGER") {  //other shade of red
                    air_color = '#1EAD2222'
                    air_stroke_color = '#AD2222'
                    air_opacity = 1
                    air_stroke_width = 3
                } else if (air_class=="PROHIBITED") {  //other shade of red - purple
                        air_color = '#1E3D0064'
                        air_stroke_color = '#3D0064'
                        air_opacity = 1
                        air_stroke_width = 3
                } else  {  //yellow
                    air_color = '#1EE3C72A'
                    air_stroke_color = '#E3C72A'
                    console.log("Airspace "+air_id+" has a not specified class "+air_class)
                }

                map.addPolyline({
                    id: air_id,
                    color: air_stroke_color,
                    width: air_stroke_width, //Set the width of the line (default 5)
                    opacity: air_opacity,
                    points: a_locations
                })
            } //ends distkm
        } //ends FOR
    }, function(error) {
        console.log(JSON.stringify(error));
    })
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

//Calculates time of flight
function calcRidingTime(s,n) {
    var dt2 = new Date(n);
    var dt1 = new Date(s);
    var diff =(dt2.getTime() - dt1.getTime()) / 1000;

//console.log("Calc riding Hora inicio: "+dt1+" Hora do snap: "+dt2+" diferença: "+twelveHourClock(diff))

    flightDurationHolder.text = twelveHourClock(diff)+'h';  
}

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