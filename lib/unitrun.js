// TODO: 
// предусмотреть:
// - обрывание тестов при частом запуске
// - ошибки при запуске
// - вывод сообщения при удачном завершении тестов
// - паузу для тестов
;(function() {
    "use strict";
    
    var CompositeDisposable = require("atom").CompositeDisposable;
    var subscription = new CompositeDisposable();
    var paneEvents;
    var fs = require("fs");
    
    module.exports = {
        activate: function() {
            this.root = atom.project.getDirectories()[0].getPath();
            this.config = this.readConfig();
            if ( !this.config ) {
                return;
            }
            
            subscription.add( atom.workspace.observeActivePaneItem(this.onActivePane.bind(this)) );
        },
        
        onActivePane: function() {
            var editor = atom.workspace.getActiveTextEditor();
            if ( !editor ) {
                return;
            }
            
            if ( paneEvents ) {
                paneEvents.dispose();
            }
            
            paneEvents = new CompositeDisposable();
            
            paneEvents.add( editor.onDidSave(this.onSave.bind(this, editor)) );
        },
        
        onSave: function(editor) {
            var names = this.getUnitNames(editor.getText());
            if ( !names ) {
                return;
            }
            
            this.runUnits(names);
        },
        
        getUnitNames: function(text) {
            var lines = text.trim().split("\n");
            var firstline = lines[0];
            
            if ( !firstline || !/^\/\/\s*unit\s*\:\s*\w+/.test(firstline) ) {
                return;
            }
            
            var names = [];
            try {
                names = firstline.split(":")[1].trim().split(/\s*,\s*/);
            } catch(e) {}
            
            if ( !names.length ) {
                return;
            }
            
            return names;
        },
        
        readConfig: function() {
            var config = false;
            var file = this.root + "/.unitrun", stat;
            
            try {
                stat = fs.statSync(file);
                if ( stat.isFile() ) {
                    config = fs.readFileSync(file).toString();
                    config = JSON.parse(config);
                }
            } catch(e) {
                console.log("unitrun: config not found");
                config = false;
            }
            
            return config;
        },
        
        runUnits: function(names) {
            this.runUnit(names[0]);
        },
        
        runUnit: function(name, callback) {
            var iframe = document.createElement("iframe");
            document.body.appendChild(iframe);
            
            var stop = false;
            var errors = {};
            
            var onLog = function(res) {
                if ( stop ) {
                    return;
                }
                
                if ( !res ) {
                    console.log("unitrun: undefined result");
                    return;
                }
                
                if ( res && !res.result ) {
                    errors[res.testId] = res;
                }
            }.bind(this);
            
            var onDone = function(results) {
                if ( stop ) {
                    return;
                }
                
                if ( Object.keys(errors).length ) {
                    this.showErrors(errors);
                    removeIframe();
                }
            }.bind(this);
            
            var removeIframe = function() {
                if ( iframe && iframe.parentNode ) {
                    iframe.parentNode.removeChild(iframe);
                }
                iframe = false;
                stop = true;
            };
            
            iframe.src = this.config.baseUrl + name + "/" + name + ".html";
            iframe.onload = function() {
                var QUnit = iframe.contentWindow.QUnit;
                
                QUnit.log(onLog);
                QUnit.done(onDone);
                
                // удаляем iframe по истечению 5 секунд, 
                // если ошибок в это время не было
                setTimeout(removeIframe, 5000);
            };
        },
        
        showErrors: function(errors) {
            
            var message, error;
            for (var key in errors) {
                error = errors[key];
                
                message = "";
                message += error.message + "<br/>";
                message += error.source + "<br/>";
                
                atom.notifications.addError(message);
            }
        }
    };

})();
