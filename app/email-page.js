var createViewModel = require("./email-view-model").createViewModel;
var appSettings = require("application-settings");


function onNavigatingTo(args) {
    var page = args.object;
    
    page.bindingContext = createViewModel(page);
}

exports.onNavigatingTo = onNavigatingTo;