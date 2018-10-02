var Observable = require("data/observable").Observable;
var frames = require("ui/frame");
var dialogs = require("ui/dialogs");
//Module to save local data
var appSettings = require("application-settings");
var platform = require("platform");
var fs = require("file-system");
var BitmapFactory = require("nativescript-bitmap-factory");
var enums = require("ui/enums");
//Stopped to work with version NS 4.2.0
/*
var imageSource = require("image-source");
var imagepickerModule = require("nativescript-imagepicker");
*/
var ImageModule = require("ui/image");
var appversion = require("nativescript-appversion");
var versao;

appversion.getVersionName().then(function(v) {
    console.log("Your app's version is: " + v);
    versao = v;
});


var folder = fs.knownFolders.documents();

//Color picker
//var colorPicker = require("nativescript-color-picker")

//var orientation = require('nativescript-orientation');
//orientation.disableRotation(); // The screen will no longer rotate 


//Connection with Firebase for login
var firebase = require("nativescript-plugin-firebase");

//Controls picture change
var changedPicture = 0;
var source;
var tempPhoto;
var picExt;





function createViewModel(args) {
    var viewModel = new Observable();
    var page = args;
/*
    //used with colorPicker
    var decToHex = function(number) {
        if (number < 0)
        {
            number = 0xFFFFFFFF + number + 1;
        }
        return number.toString(16).substring(2,8).toUpperCase();
    }
*/
    //get ready for Facebook or Local info
    var fbMeasurement = appSettings.getString("system", "imperial");
    var fbName = appSettings.getString("name", "");
    var fbNick = appSettings.getString("nick", "");
    var fbPhoto = appSettings.getString("photo", "res://ic_photo");
    var fbMain = appSettings.getString("secColor", "#FF0000");
    var fbSec = appSettings.getString("mainColor", "#00FF00");
    var fbUID = appSettings.getString("uid", "");
    var fbIcon = appSettings.getString("icon", "mk_red_green");
    var selectedMap = appSettings.getString("map", "Streets");
    var fbAutoZoom = appSettings.getString("autoZoom", "on");
    var fbColorBlind = appSettings.getString("colorBlind", "off");
    var showAltAlerts = appSettings.getString("showAltAlerts", "off");
    console.log("*********** Loaded photo:  "+fbPhoto)
    console.log("*********** UID:  "+fbUID)

    //2.5 Camera controle
    var fbCamera = appSettings.getString("camera", ""); //camera name
    var fbCameraMac = appSettings.getString("cameraMac", "");
    if (fbCamera!="") {
        viewModel.switchCamera = true;
    } else {
        viewModel.switchCamera = false;
    }
    console.log("fbCamera:  "+fbCamera+" switchCamera:"+viewModel.switchCamera)
    var voiceAlert = appSettings.getString("voiceAlert", "false");

    var mapHolder = page.getViewById("mapSelected");
    var loading = page.getViewById("loading");
    var version = page.getViewById("version"); //workaround for Android as it cannot load the version name before rendering the XML

    fbUID = appSettings.getString("uid", "");

    //get variables and set bindables
    viewModel.hello = fbName;
    viewModel.fbID = fbUID.substr(0,5);
    viewModel.nickname = fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();});  //sets all first letters in Capital

    viewModel.fbIcon = "res://"+fbIcon;
    var fbIconHolder = page.getViewById("fbIconHolder");
    var fbPhotoHolder = page.getViewById("fbPhotoHolder");
    //viewModel.secColorButton = page.getViewById("secColorButton"); 
    if(fbMeasurement==="metric") {
        viewModel.switch = false;
    } else {
        viewModel.switch = true;
    }

    //autozoom
    if(fbAutoZoom==="on") {
        viewModel.switchZoom = true;
    } else {
        viewModel.switchZoom = false;
    }

    //2.5.8 color blind was replaced by showAltAlerts
    if(showAltAlerts==="on") {
        viewModel.switchColor = true;
    } else {
        viewModel.switchColor = false;
    }
    

    //voiceAlert
    if(voiceAlert==="true") {
        //console.log("setting voiceAlert ON: "+voiceAlert)
        viewModel.switchVoice = true;
    } else {
        //console.log("setting voiceAlert OFF: "+voiceAlert)
        viewModel.switchVoice = false;
    }

    //Selected map
    if(selectedMap==="Streets") {
        mapHolder.selectedIndex = 0;
    } else if (selectedMap==="Light") {
        mapHolder.selectedIndex = 1;
    } else if (selectedMap==="Dark") {
        mapHolder.selectedIndex = 2
    } else if (selectedMap==="Satellite") {
        mapHolder.selectedIndex = 3;
    } else if (selectedMap==="Hybrid") {
        mapHolder.selectedIndex = 4
    }

    viewModel.version = versao;
    
    console.log(L('version', versao))
    console.log("fbPhoto: "+fbPhoto)
    console.log("Preferences: "+fbPhoto)
    viewModel.fbPhoto = fbPhoto;

    viewModel.onTapIcon = function(args) {
        fbIcon = args.object["id"];
        fbMain = fbIcon.substr(3,fbIcon.lastIndexOf("_")-3);
        fbSec = fbIcon.substr(fbIcon.lastIndexOf("_")+1,fbIcon.length) 
        console.log("Icon color: "+fbIcon)
        fbIconHolder.src = "res://"+fbIcon;

         page.addCss(".photo { border-color: "+fbMain+" }");
    }


    viewModel.onTapPhoto = function(args) {
        //Re-enable it when it is fixed
        /*
        var context = imagepickerModule.create({
            mode: "single"
        });
        startSelection(context);
        */
    }
    
    function startSelection(context) {
        context
            .authorize()
            .then(function() {
                return context.present();
            })
            .then(function(selection) {
                selection.forEach(function(selected) {
                    console.log("Selection done: " + JSON.stringify(selection));
                    var a = "";
                    console.log("SELECTED FILE: "+JSON.stringify(selected))
                    if (page.android) {
                        a = selected.android.toString();
                        source = a;
                        console.log("Android source: "+source)
                        fbPhotoHolder.src = source;
                    } else {
                        // selected_item.ios for iOS is PHAsset and not path - so we are creating own path
                        const opt = PHImageRequestOptions.new();
                        opt.version = PHImageRequestOptionsVersion.Current;
                        PHImageManager.defaultManager().requestImageDataForAssetOptionsResultHandler(
                            selected.ios, opt, (NSData, dataUTI, UIImageOrientation, NSDictionary) => {
                            a = NSDictionary.objectForKey("PHImageFileURLKey").toString();
                            console.log("CAPTURED FILE NAME:"+a)
                            //CAPTURED FILE NAME:file:///var/mobile/Media/DCIM/100APPLE/IMG_0883.JPG
                            picExt = a.substr(a.length-3, a.length).toLowerCase()
                            console.log("ext: "+picExt)
                            console.log("file name: "+'uploads/'+fbUID+'/photo.'+picExt)
                            source = a.substr(7, a.length)
                            //var source = "/Media/DCIM/100APPLE/IMG_0882.JPG";
                            console.log("iOS source: "+source)

                            var path = fs.path.join(folder.path, fbUID+"_temp.jpg");
                            console.log("PATH: "+path)
                            a = a || selection[0].a;
                            //this.upload(a);
                            var img = a
                            var bmp = BitmapFactory.create(100, 100);
                            bmp.dispose(function(b) {
                                b.insert(img);
                                var b2 = b           
                                var thumb_image = b2.toImageSource();            
                                var saved = thumb_image.saveToFile(
                                    path,
                                    enums.ImageFormat.jpeg
                                );
                                if (saved) {
                                    // ## Use resized image
                                    console.log("Salvou local image!!! "+ path)
                                    //Upload image to FB Storage
                                    firebase.storage.uploadFile({
                                        // the full path of the file in your Firebase storage (folders will be created)
                                        remoteFullPath: 'uploads/'+fbUID+'/temp_photo.jpg',
                                        localFullPath: path, //selected.fileUri,
                                        // get notified of file upload progress
                                        onProgress: function(status) {
                                            console.log("Uploaded fraction: " + status.fractionCompleted);
                                            console.log("Percentage complete: " + status.percentageCompleted);
                                            loading.text = status.percentageCompleted+"% uploaded."
                                        }
                                    }).then(
                                        function (uploadedFile) {
                                            console.log("File uploaded: " + JSON.stringify(uploadedFile));
                                            console.log("URL: "+JSON.stringify(uploadedFile.url))
                                            loading.text = "Set your nickname below"
                                            tempPhoto = JSON.stringify(uploadedFile.url);
                                            
                                            //Update preferences file
                                            tempPhoto = JSON.stringify(uploadedFile.url);
                                            tempPhoto = String(tempPhoto).substr(1, tempPhoto.length-2)

                                            //Update image by this new one link
                                            fbPhotoHolder.src = tempPhoto; //String(fbPhoto).substr(1, fbPhoto.length-2); //String(fbPhoto).substr(1, fbPhoto.length-2);
                                        },
                                        function (error) {
                                            alert("File upload error: " + error);
                                        }
                                    );
                                    source = fs.path.join(folder.path, fbUID+".jpg");
                                    fbPhotoHolder.src = source;
                                }
                            });
                         });
                    }
                   
                    changedPicture = 1;

                    /*
                    selected.getImage().then((imagesource)=>{
                        //console.log("uri: " + selected.uri);           
                        console.log("fileUri: " + selected.fileUri);
                        //console.log("get image: "+selected.getImage())

                        var a = selected.fileUri;
                        picExt = a.substr(a.length-3, a.length).toLowerCase()
                        //console.log("ext: "+picExt)
                        //console.log("file name: "+'uploads/'+fbUID+'/photo.'+picExt)

                        //Right names for each platform
                        if (page.ios) {
                            //instead of getting fileUri=file:///Users/... must remove fileUri:// from the name
                            source = a.substr(7, a.length)
                            //var source = "/Media/DCIM/100APPLE/IMG_0882.JPG";
                            //console.log("iOS source: "+source)

                            var path = fs.path.join(folder.path, fbUID+"_temp.jpg");
                            //console.log(path)
                            var img = imagesource; //imageSource.fromFile(source);

                            //var bmp = BitmapFactory.create(img.width, img.height);
                            var bmp = BitmapFactory.create(100, 100);

                            bmp.dispose(function(b) {
                                b.insert(img);
                                var b2 = b           
                                var thumb_image = b2.toImageSource();            
                                var saved = thumb_image.saveToFile(
                                    path,
                                    enums.ImageFormat.jpeg
                                );
                                if (saved) {
                                    // ## Use resized image
                                    console.log("Salvou local image!!! "+ path)
                                    //Upload image to FB Storage
                                    firebase.storage.uploadFile({
                                        // the full path of the file in your Firebase storage (folders will be created)
                                        remoteFullPath: 'uploads/'+fbUID+'/temp_photo.jpg',
                                        localFullPath: path, //selected.fileUri,
                                        // get notified of file upload progress
                                        onProgress: function(status) {
                                            console.log("Uploaded fraction: " + status.fractionCompleted);
                                            console.log("Percentage complete: " + status.percentageCompleted);
                                            loading.text = status.percentageCompleted+"% uploaded."
                                        }
                                    }).then(
                                        function (uploadedFile) {
                                            console.log("File uploaded: " + JSON.stringify(uploadedFile));
                                            console.log("URL: "+JSON.stringify(uploadedFile.url))
                                            loading.text = "Set your nickname below"
                                            tempPhoto = JSON.stringify(uploadedFile.url);
                                            
                                            //Update preferences file
                                            tempPhoto = JSON.stringify(uploadedFile.url);
                                            tempPhoto = String(tempPhoto).substr(1, tempPhoto.length-2)

                                            //Update image by this new one link
                                            fbPhotoHolder.src = tempPhoto; //String(fbPhoto).substr(1, fbPhoto.length-2); //String(fbPhoto).substr(1, fbPhoto.length-2);
                                        },
                                        function (error) {
                                            alert("File upload error: " + error);
                                        }
                                    );
                                    source = fs.path.join(folder.path, fbUID+".jpg");
                                    fbPhotoHolder.src = source;
                                }
                            });

                        } else {
                            source = a;
                            console.log("Android source: "+source)
                            fbPhotoHolder.src = source;
                        } 
                        changedPicture = 1;

                    }) //ends selected.getImage
                    */
                });
            }).catch(function (e) {
                console.log(e);
            });
    }
    

    viewModel.onDash = function() {
        var navigationEntry = {
            moduleName: "dash_live-page",
            animated: true,
            transition: {
                name: "slideBottom",
                duration: 380,
                curve: "easeIn", clearHistory: true
            }
        };
        frames.topmost().navigate(navigationEntry);
    }

    viewModel.onFlights = function() {
        var navigationEntry = {
            moduleName: "flights-page",
            animated: true,
            transition: {
                name: "slideBottom",
                duration: 380,
                curve: "easeIn", clearHistory: true
            }
        };
        frames.topmost().navigate(navigationEntry);
    }

  
    viewModel.onTapSwitch = function(args) {
        if(fbMeasurement==="metric") {
            fbMeasurement = "imperial";
        } else {
            fbMeasurement = "metric";
        }
    }

    viewModel.onTapZoom = function(args) {
        if(fbAutoZoom==="on") {
            fbAutoZoom = "off";
        } else {
            fbAutoZoom = "on";
        }
    }

    viewModel.onTapSwitchColor = function(args) {
        if(showAltAlerts==="on") {
            showAltAlerts = "off";
        } else {
            showAltAlerts = "on";
        }
    }

    viewModel.onTapVoice = function(args) {
        if(voiceAlert==="true") {
            voiceAlert = "false";
        } else {
            voiceAlert = "true";
        }
    }

    viewModel.onTapGoPro = function(args) {
        if(viewModel.switchCamera) {
            viewModel.switchCamera = "false";
        } else {
            viewModel.switchCamera = "true";
        }
    }
    viewModel.onTapMap = function(args) {
        if(args.newIndex===0) {
            selectedMap = "Streets";
        } else if(args.newIndex===1) {
            selectedMap = "Light";
        } else if(args.newIndex===2) {
            selectedMap = "Dark";
        } else if(args.newIndex===3) {
            selectedMap = "Satellite";
        } else if(args.newIndex===4) {
            selectedMap = "Hybrid";
        }
    }

    //Reauthentication Facebook or Email
    viewModel.onReauth = function(args) {
/*
        firebase.reauthenticate({
            type: firebase.LoginType.FACEBOOK
          }).then(
              function () {
                // you can now safely delete the account / change the password

                //fbUID = appSettings.setString("uid", "");
                var navigationEntry = {
                    moduleName: "main-page",
                    clearHistory: true
                    animated: true,
                    transition: {
                        name: "fade",
                        duration: 380,
                        curve: "easeIn" 
                    }
                };
                frames.topmost().navigate(navigationEntry);
              },
              function (error) {
                dialogs.alert({
                  title: "Re-authenticate error",
                  message: error,
                  okButtonText: "OK"
                });
              }
          );
*/
            firebase.reauthenticate({
                type: firebase.LoginType.FACEBOOK
            })
            //firebase.logout();
            //fbUID = appSettings.setString("uid", "");
            var navigationEntry = {
                moduleName: "main-page",
                clearHistory: true,
                animated: true,
                transition: {
                    name: "fade",
                    duration: 380,
                    curve: "easeIn"
                }
            };
            frames.topmost().navigate(navigationEntry);
    }

    //updates user info at firebase DB
    viewModel.onUpdate = function() {
        //gets the nickname and the colors and update the record in firebase
        fbNick = viewModel.nickname
        //fbSec = viewModel.fbSec
        if (fbNick==="" && fbName!="") {
            fbNick = fbName.replace(/\s+/g, '');   
            console.log("Setting Nick: "+fbNick)
        }

        //upload image to Firebase Storage
        if (changedPicture) {
            //if(page.ios) {
                console.log("tempPhoto: "+tempPhoto)
                //delete temporary file
                firebase.storage.deleteFile({
                    // the full path of an existing file in your Firebase storage
                    remoteFullPath: 'uploads/'+fbUID+'/temp_photo.'+picExt,
                }).then(
                    function () {
                        console.log("File deleted: "+'uploads/'+fbUID+'/temp_photo.'+picExt);
                    },
                    function (error) {
                        console.log("File deletion Error: " + error);
                    }
                );

                //Delete current user picture
                //var path = fs.path.join(folder.path, fbUID+".jpg");
                folder.getFile(fbUID+".jpg").remove();

                //Rename temp pict to current
                folder.getFile(fbUID+"_temp.jpg").rename(fbUID+".jpg");
            //}
            
            console.log("SOURCE: "+source)
            firebase.storage.uploadFile({
                // the full path of the file in your Firebase storage (folders will be created)
                remoteFullPath: 'uploads/'+fbUID+'/'+fbUID+'.jpg',
                localFullPath: source, //selected.fileUri,
                // get notified of file upload progress
                onProgress: function(status) {
                    console.log("Uploaded fraction: " + status.fractionCompleted);
                    console.log("Percentage complete: " + status.percentageCompleted);
                    loading.text = status.percentageCompleted+"% uploaded."
                }
            }).then(
                function (uploadedFile) {
                    console.log("File uploaded: " + JSON.stringify(uploadedFile));
                    console.log("URL: "+JSON.stringify(uploadedFile.url))
                    loading.text = "Set your nickname below"
                    
                    //Update preferences file
                    fbPhoto = JSON.stringify(uploadedFile.url);
                    fbPhoto = String(fbPhoto).substr(1, fbPhoto.length-2)

                    firebase.update(
                        '/users/'+fbUID,
                        {   
                            'photo': fbPhoto
                        }
                    );
                    appSettings.setString("photo", fbPhoto); //String(fbPhoto).substr(1, fbPhoto.length-2));
                    console.log("Uploaded no FB: "+fbPhoto)

                    //Update image by this new one link
                    fbPhotoHolder.src = fbPhoto; //String(fbPhoto).substr(1, fbPhoto.length-2); //String(fbPhoto).substr(1, fbPhoto.length-2);
                },
                function (error) {
                    alert("File upload error: " + error);
                }
            );
            
        } 

        //Saves into Firebase (if online and logged with Facebook - in this case, fbUID is different than "")     
        if(fbUID!="") {
            console.log("Saving at firebase "+fbUID)
            //console.log("fbPhoto: "+fbPhoto)

            firebase.update(
                '/users/'+fbUID,
                {   'nick':fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();}),
                    'mainColor': fbMain,
                    'secColor': fbSec,
                    'icon':fbIcon,
                    'measurement': fbMeasurement
                }
            );
        }

        //Saves locally
       if (fbNick==="" && fbName==="") {
            alert("You must set your name and nickname first!")
        } else {
            fbName = fbNick;
            appSettings.setString("system", fbMeasurement);
            appSettings.setString("name", fbName);
            appSettings.setString("nick", fbNick.toLowerCase().replace(/(^|\s)[a-z]/g,function(f){return f.toUpperCase();}));
            //appSettings.setString("photo", fbPhoto); //String(fbPhoto).substr(1, fbPhoto.length-2));
            appSettings.setString("mainColor", fbMain);
            appSettings.setString("secColor", fbSec);
            appSettings.setString("uid", fbUID);
            appSettings.setString("icon", fbIcon);
            appSettings.setString("system", fbMeasurement);
            appSettings.setString("map", selectedMap);
            appSettings.setString("autoZoom", fbAutoZoom);
            //appSettings.setString("colorBlind", fbColorBlind); replaced by showAltAlert 2.5.8
            appSettings.setString("showAltAlerts", showAltAlerts);
            appSettings.setString("voiceAlert", voiceAlert);
            
            //camera control - now only for goPro 4+
            console.log("Salvando camera: "+viewModel.switchCamera)
            if (viewModel.switchCamera) {
                appSettings.setString("camera", "goPro");
                //fbCamera = "goPro"
            } else {
                appSettings.setString("camera", "");
                fbCamera = ""
            }

            var navigationEntry = {
                moduleName: "dash_live-page",
                animated: true,
                transition: {
                    name: "slideBottom",
                    duration: 380,
                    curve: "easeIn", clearHistory: true
                }
            };
            frames.topmost().navigate(navigationEntry);
            //frames.topmost().navigate({ moduleName: "dash_live-page", clearHistory: true });
        }
        

    }

/*
    //used with colorPicker
    //selects glider secundary color
    viewModel.onSecColor = function(args) {
        //show a color picker and allow new color selection
        //update the button color after selection
        var picker = new colorPicker.ColorPicker();
            picker.show(fbSec, 'HEX').then((result) => {
            console.log('color int: ' + result);
            fbSec = "#"+decToHex(result);


            var btn = args.object;
            btn.backgroundColor = fbSec;

        }).catch((err) => {
            console.log(err)
        })
        
    }

    //selects glider main color
    viewModel.onMainColor = function(args) {
        //show a color picker and allow new color selection
        //update the button color after selection
       var picker = new colorPicker.ColorPicker();
       picker.show(fbMain, 'HEX').then((result) => {
            console.log('color int: ' + result);
            fbMain = "#"+decToHex(result);


            var btn = args.object;
            //alert("#"+decToHex(result))
            btn.backgroundColor = fbMain;

        }).catch((err) => {
            console.log(err)
        })
    }
    */

    //workaround for Android as it cannot load the version name before rendering the XML
    if (!page.ios) {
        //console.log("é Android")
        //console.log("rodou o timer "+versao)
        setTimeout(function() {
            //console.log("rodou o timer "+versao)
            version.text = L('version', versao);
        }, 2000);
    }


    
    
    
    return viewModel;
}

exports.createViewModel = createViewModel;
