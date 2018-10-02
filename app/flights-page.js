//FLIGHTS
/* Lists all flights */

//Common libraries
var frames = require("ui/frame");
var dialogs = require("ui/dialogs");

//var orientation = require('nativescript-orientation');
var firebase = require("nativescript-plugin-firebase");

var appSettings = require("application-settings");
var view = require("ui/core/view");

//var pageModule = require("ui/page");
//var falert = require("nativescript-fancyalert");  //used to tell user "we are getting your flights!"

//var LoadingIndicator = require("nativescript-loading-indicator").LoadingIndicator;
//var loader = new LoadingIndicator();


// Zeroes all variables
var fbMi
var fbSp
var fbFt
var fbUID = appSettings.getString("uid", "");
//fbUID="9LPnl4AyNkd7LpcOkyRn5zo2hL13" //Use to test other pilots flights
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

var listview

var Observable = require("data/observable").Observable;
var ObservableArray = require("data/observable-array").ObservableArray;

var page;
var items = new ObservableArray([]);
var pageData = new Observable();

var tste = []; //holds the list data

//2.4 Buddies and Snaps
var buddies = 0
var snaps

//sets temporary database
var tempDB
appSettings.setString("migrated", "")
var fbMigrated = appSettings.getString("migrated", "");

//2.5 Force reload
var reload = false


exports.pageLoaded = function(args) {
    page = args.object;
    listview = page.getViewById("listview");
    
    page.bindingContext = pageData;

    pageData.set("items", items)

    console.log("calling checkDB !!!")
    checkDB();


}

function checkDB() {
    console.log("em checkDb")
        //check if temp database is already created
        var onQueryUserEvent = function(result) {
            if (!result.error) {
                console.log("fbUID: "+fbUID); var dx = JSON.parse(JSON.stringify(result.value)); console.log(dx)
                //console.log("LINHA 130: "+result.value[fbUID]["migrated"]) 
                //console.log("#flights: "+JSON.stringify(result.value))
                if (String(dx)!="null") {
                    tempDB = result.value[fbUID]["migrated"];
                } else {
                    tempDB = "undefined"
                }
                 //String(dx[fbUID].migrated)

                //*** UNCOMMENT THIS LINE TO FIX ISSUES WITH MIGRATION */
                //tempDB = undefined;
                //console.log("ACABOU DE LER TEMPDB: "+tempDB)
                //console.log("MIGRATED: "+dx[fbUID].migrated+" - "+tempDB+" -> "+dx[fbUID].nick)
                /*
                if (tempDB!="temp") {
                    //create flights_temp copy
                    tempDB()
                } else {
                    loadList()
                }
                */
                console.log("calling loadList with "+tempDB)
                loadList()
            }
        }
        firebase.query(
            onQueryUserEvent,
            "/users",
            {
                singleEvent: true,
                orderBy: {
                    type: firebase.QueryOrderByType.KEY
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
}
 

//shows Settings
exports.showSettings = function(args){ 
        var navigationEntry = {
            moduleName: "settings-page",
            animated: true,
            transition: {
                name: "slideTop",
                duration: 380,
                curve: "easeIn", clearHistory: true
            }
        };
        frames.topmost().navigate(navigationEntry);
}

//shows Dashboard
exports.showDash = function(args){
        var navigationEntry = {
            moduleName: "dash_live-page",
            animated: true,
            transition: {
                name: "slideRight",
                duration: 380,
                curve: "easeIn", clearHistory: true
            }
        };
        frames.topmost().navigate(navigationEntry);
}

//Buids listView
function loadList(args) {
    //console.log("tempDB: "+tempDB)
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
    //console.log(tste.length)
    if (tste.length<=0) {
       // loader.show({message: ""} );
    }
       
    var onQueryEvent = function(result) {
        if (!result.error) { 
            //clean up the list    
            items.splice(0, items.length); 
            tste = []  
            var buddyNum = "-"
            for(let fid in result.value){
                //2.4 shows buddies and snaps count
                snaps = result.value[fid]["snapshots"]
                buddies = result.value[fid]["buddies"]
                console.log("fid: "+fid+"# snaps: "+snaps+" # buddies: "+JSON.stringify(buddies))
                if (snaps==undefined) {
                    snaps = 0
                } else if (snaps.length>=0){
                    snaps = snaps.length
                }

                if(buddies==undefined){
                    buddyNum = "-"
                } else {
                    buddyNum = buddies.length
                }

                var maxSpeed =  result.value[fid]["maxSpeed"]
                var duration =  result.value[fid]["duration"]
                var distance = result.value[fid]["distance"]
                var fday = result.value[fid]["fid"]

                if (fday==undefined) { fday = fid }
                //console.log("fday: "+fday+" fid: "+fid)
                var fPlace = result.value[fid]["place"]
                if (String(fPlace)=="undefined") {
                    fPlace = ""
                }
                //ratings
                var fRating = result.value[fid]["rating"]
                var oldrating = 3
                if (String(fRating)=="undefined") {
                    fRating = "res://ic_rating2"
                } else {
                    fRating = "res://ic_rating"+fRating
                    oldrating = result.value[fid]["rating"];
                }

                //2.5 checks if flights_temp database already exists - PULL TO REFRESH RELOAD
                //console.log("fday: "+fday+" tempDB: "+tempDB+" reload:"+reload)
                if (fday!=undefined && String(tempDB) == "undefined" || reload) {
                    console.log("Migrating database...")
                    //copy DB
                    firebase.setValue(
                        'flights_temp/'+fbUID+'/'+fday,
                        {
                                fid: fday,
                                maxSpeed: String(maxSpeed),
                                duration: duration,
                                distance: distance,
                                rating: oldrating,
                                snapshots: snaps,
                                buddies: buddies,
                                place: fPlace
                        }
                    );
                }


                //converts back to the proper system
                if (fbMeasurement === "imperial") {
                    maxSpeed = (maxSpeed / 0.447).toFixed(0);
                    distance = Number(distance * 0.000621371).toFixed(1);
                } else {
                    maxSpeed = (maxSpeed * 3.6).toFixed(0);
                    distance = Number(distance/1000).toFixed(1);
                }

                //builds day name               
                var d = new Date(Number(fday))
                //var days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                var days = [L('sun'),L('mon'),L('tue'),L('wed'),L('thu'),L('fri'),L('sat')];

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
                //console.log("FDAY: "+fday+ " fid: "+fid+" rating: "+result.value[fid]["rating"])
                //console.log("FDAY: "+fday+ " snaps: "+snaps)
                if (fday!="undefined, NaN/NaN") {
                    tste.push(
                        {   
                            flightMaxSpeed: maxSpeed, 
                            flightTime: duration,
                            flightDistance: distance, 
                            flightName: fday,
                            mi: fbMi,
                            mph: fbSp,
                            date: month + "/" + day,
                            flightPlace: fPlace,
                            flightRating: fRating,
                            fid: Number(result.value[fid]["fid"]),
                            snaps: snaps,
                            buddies: buddyNum,
                            place: fPlace
                    })
                    //tste.push({fday: fday, fid: fid})
                }                   

            }  

            //items.sort(function(a,b) {return (a.fid > b.fid) ? 1 : ((b.fid > a.fid) ? -1 : 0);} );
            //items.reverse();   

            tste.sort(function(a,b) {return (a.fid > b.fid) ? 1 : ((b.fid > a.fid) ? -1 : 0);} );
            tste.reverse();
            //loader.hide();

            if (tste.length<1) {
                alert(L('noFlightsYet')) 
            }     

            if (String(tempDB) === "undefined") {
                console.log("updating users db")
                //update users DB
                firebase.update(
                    '/users/'+fbUID,
                    {   'migrated': "temp"
                    }
                );

                //appSettings.setString("migrated", "temp");
            }

        }; //end if onQuery
        
        //Workaround to work with iOS as items.sort is not working
        for (i=0;i<tste.length;i++){
            //console.log(i+" -> "+tste[i].fid+" -> "+tste[i].flightPlace)
            items.push({   
                    flightMaxSpeed: tste[i].flightMaxSpeed, 
                    flightTime: tste[i].flightTime,
                    flightDistance: tste[i].flightDistance, 
                    flightName: tste[i].flightName,
                    mi: fbMi,
                    mph: fbSp,
                    flightPlace: tste[i].flightPlace,
                    flightRating: tste[i].flightRating,
                    fid: tste[i].fid,
                    snaps: tste[i].snaps,
                    buddies: tste[i].buddies
            })
        }
        
        reload = false
    } //end onQuery

    //queries the temporary database
    console.log("tempDB em loadList: "+tempDB)
    //tempDB="undefined"; //use to FORCE rebuild of tempDB
    console.log("undefined->"+tempDB+"->"+String(tempDB)+ " reload: "+reload)
    if (String(tempDB) != "undefined" && reload==false) {
        console.log("using flights_temp")
        firebase.query(
            onQueryEvent,
            "/flights_temp/"+fbUID,
            {
                // set this to true if you want to check if the value exists or just want the event to fire once
                // default false, so it listens continuously.
                // Only when true, this function will return the data in the promise as well!
                singleEvent: true,
                // order by company.country
                orderBy: {
                    type: firebase.QueryOrderByType.CHILD,
                    value: 'fid' // mandatory when type is 'child'
                }/*,
                limit: {
                    type: firebase.QueryLimitType.LAST,
                    value: 5
                }*/
            }
        );
    } else {
        console.log("using flights db")
        //loader.show({message: ""} );
        firebase.query(
            onQueryEvent,
            "/flights/"+fbUID,
            {
                // set this to true if you want to check if the value exists or just want the event to fire once
                // default false, so it listens continuously.
                // Only when true, this function will return the data in the promise as well!
                singleEvent: true,
                // order by company.country
                orderBy: {
                    type: firebase.QueryOrderByType.CHILD,
                    value: 'fid' // mandatory when type is 'child'
                }/*,
                limit: {
                    type: firebase.QueryLimitType.LAST,
                    value: 5
                }*/
            }
        ); 
    }
}

/*
//Swipe controls
 exports.onSwipeCellStarted = function(args) {
    var swipeLimits = args.data.swipeLimits;
    var swipeView = args['object'];
    var leftItem = swipeView.getViewById('delete-view');
    var rightItem = swipeView.getViewById('delete-view');
    swipeLimits.left = 0; //rightItem.getMeasuredWidth();
    swipeLimits.right = rightItem.getMeasuredWidth();
    swipeLimits.threshold = leftItem.getMeasuredWidth() / 2;
}

exports.onRightSwipeClick = function (args) {
    console.log("Right swipe click");
    console.log(JSON.stringify(args.object.bindingContext))
    console.log("Deletar: "+args.object.bindingContext.fid)
    items.splice(items.indexOf(args.object.bindingContext), 1);
    //remove from Firebase
    var activePath = 'flights/'+fbUID+'/'+args.object.bindingContext.fid;
    var data = {};
    data[activePath] = null;
  //  firebase.update('/', data);

    listview.notifySwipeToExecuteFinished();
}
*/

exports.listViewItemTap = function(args) {
    if(items.getItem(args.index).fid!=null) {
        console.log("Listview click:"+items.getItem(args.index).fid);
        //loader.hide();
        //console.log(JSON.stringify(args.object.bindingContext))
        //console.log("Clicou: "+args.object.bindingContext.fid)
        //appSettings.setString("fid", String(args.object.bindingContext.fid));
        appSettings.setString("fid", String(items.getItem(args.index).fid));
        var navigationEntry = {
                moduleName: "flight-page",
                context: {fid: items.getItem(args.index).fid},
                animated: false,
                clearHistory: false
            };
            frames.topmost().navigate(navigationEntry);
    }
    
}

//listview row colors
exports.onItemLoading = function(args) {
    //loader.hide();
    if (args.index % 2 == 0){
        args.view.backgroundColor="#172126"; 
    }
    else {
        args.view.backgroundColor="#1F272A";
    }
}

exports.onPullToRefreshInitiated = function(){
    setTimeout(function() {
        console.log("PULL TO REFRESH!!")
        dialogs.confirm({
            title: L('reloadTitle'),
            message: L('reloadMessage'),
            okButtonText: L('no'),
            cancelButtonText: L('yes')
        }).then(function (resulta) {
            if (!resulta) {
                reload=true
                tempDB=undefined
                checkDB()
            }
        });
        listview.notifyPullToRefreshFinished();
    }, 1000);
}
/*
//keep database in sync
firebase.keepInSync(
    "/flights/"+fbUID, // which path in your Firebase needs to be kept in sync?
    true      // set to false to disable this feature again
  ).then(
    function () {
      console.log("firebase.keepInSync is ON for /flights");
    },
    function (error) {
      console.log("firebase.keepInSync error: " + error);
    }
  );
  */