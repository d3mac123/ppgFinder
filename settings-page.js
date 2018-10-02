/*
In NativeScript, a file with the same name as an XML file is known as
a code-behind file. The code-behind is a great place to place your view
logic, and to set up your page’s data binding.
*/

/*
NativeScript adheres to the CommonJS specification for dealing with
JavaScript modules. The CommonJS require() function is how you import
JavaScript modules defined in other files.
*/ 
var createViewModel = require("./settings-view-model").createViewModel;
var appSettings = require("application-settings");


//var orientation = require('nativescript-orientation');
//  orientation.disableRotation(); // The screen will no longer rotate 

function onNavigatingTo(args) {
    /*
    This gets a reference this page’s <Page> UI component. You can
    view the API reference of the Page to see what’s available at
    https://docs.nativescript.org/api-reference/classes/_ui_page_.page.html
    */
    var page = args.object;
    
    var version = ""

    var fbMain = appSettings.getString("mainColor", "#00FF00");
    var fbSec = appSettings.getString("secColor", "#FF0000");
    page.addCss(".btn_MainColor { background-color: "+fbMain+" }");
    page.addCss(".btn_SecColor { background-color: "+fbSec+" }");
    page.addCss(".photo { border-color: "+fbMain+" }");

    //var gotData=page.navigationContext;
    //console.log(gotData.fbName)
    //global.fbPhoto = gotData.fbPhoto;
    //global.hello = "Hello "+gotData.fbName;
    
    /*
    A page’s bindingContext is an object that should be used to perform
    data binding between XML markup and JavaScript code. Properties
    on the bindingContext can be accessed using the {{ }} syntax in XML.
    In this example, the {{ message }} and {{ onTap }} bindings are resolved
    against the object returned by createViewModel().

    You can learn more about data binding in NativeScript at
    https://docs.nativescript.org/core-concepts/data-binding.
    */
    page.bindingContext = createViewModel(page);
}

/*
Exporting a function in a NativeScript code-behind file makes it accessible
to the file’s corresponding XML file. In this case, exporting the onNavigatingTo
function here makes the navigatingTo="onNavigatingTo" binding in this page’s XML
file work.
*/
exports.onNavigatingTo = onNavigatingTo;