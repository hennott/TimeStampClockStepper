var c = new Array();
c['Host'] = 'localhost';
c['Secret'] = 'secret';
c['PortBrowser'] = 4280;
c['PortServer'] = 4223;
c['Disp'] = new Array();
c['Disp']['Uid'] = 'BmD';
c['Switch'] = new Array();
c['Switch']['Uid'] = 'Byy';
c['Store'] = new Array();
c['Store']['Interval'] = 10; // in s
c['Store']['Monoflop'] = 500; // in ms
c['Store']['MonoflopBrake'] = 500; // in ms
c['Store']['Ip'] = 'localhost';

if(typeof require === 'function' ) {
    var tf = require('tinkerforge');
    var fs = require('fs')
    var http = require('http');
    c['Port'] = c['PortServer'];
    var os = require('os');
    var net = os.networkInterfaces();
    console.log(net);
    c['Store']['Ip'] = net['wlan0'][0]['address'];
} else {
    c['Port'] = c['PortBrowser'];
}

var server = http.createServer(function(req, res) {
    fs.readFile('./index.html', 'utf-8', function(error, content) {
        res.writeHead(200, {"Content-Type": "text/html"});
        res.end(content);
    });
});

var ipcon = new tf.IPConnection(); // Create IP connection
var oled = new tf.BrickletOLED128x64(c['Disp']['Uid'], ipcon); // Create device object
var iqr = new tf.BrickletIndustrialQuadRelay(c['Switch']['Uid'], ipcon);

ipcon.connect(c['Host'], c['Port'],
    function (error) {
        console.log('Error: ' + error);
    }
);

ipcon.on(tf.IPConnection.CALLBACK_CONNECTED,
    function (connectReason) {
        ipcon.authenticate(c['Secret'],
            function() {
                console.log('Authentication succeeded');

                oled.clearDisplay();
                oled.writeLine(0, 0, 'StampClockStepper');
                oled.writeLine(2, 0, 'Das System wird gestartet');
                iqr.setValue(0);

                setInterval(function () {
                    //oled.clearDisplay();
                    oled.writeLine(0, 0, 'StampClockStepper v.23');
                    
                    var Tw = new Date();
                    c['Store']['Tw'] = { "h":Tw.getHours(), "m":Tw.getMinutes(), "d":Tw.getDate()}
                    var TwTxt = time2string(c['Store']['Tw']);
                    oled.writeLine(1, 0, 'Time NTP: '+TwTxt);

                    try {
                    	c['Store']['scstmp'] = fs.readFileSync('scs.tmp', "utf8");
                    } catch (e) {
                    	c['Store']['Ts'] = {'d':0,'h':0,'m':0};
                    	timer();
                    }
                    
                    try {
						c['Store']['Ts'] = JSON.parse(c['Store']['scstmp']);
                    } catch (e) {
                    	c['Store']['Ts'] = {'d':0,'h':0,'m':0};
                    	timer();
                    }
                    
                    var TsTxt = time2string(c['Store']['Ts']);
                    oled.writeLine(2, 0, 'Time CLK: '+TsTxt+'               ');

                    var Steps = 0;
                    if((c['Store']['Tw'].d - c['Store']['Ts'].d) < 0) {
                        Steps += (31 - c['Store']['Ts'].d + c['Store']['Tw'].d) * 1440;
                    } else {
                        Steps += (c['Store']['Tw'].d - c['Store']['Ts'].d) * 1440;
                    }
                    
                    Steps += (c['Store']['Tw'].h - c['Store']['Ts'].h) * 60;
                    Steps += (c['Store']['Tw'].m - c['Store']['Ts'].m) * 1;
                    oled.writeLine(3, 0, 'Steps   : '+Steps.toString()+'               ');
                    c['Store']['Steps'] = Steps;
                    if(Steps > 0) {
                        impulse();
                    } else {
                        iqr.setValue(0);
                    }

                    oled.writeLine(4, 0, 'IP      : '+c['Store']['Ip']+'               ');

                    oled.writeLine(6, 0, 'Standby                          ');
                    oled.writeLine(7, 0, '                                 ');
                    
                }, c['Store']['Interval'] * 1000);

                setInterval(function() {
                    setTimeout(function() { oled.writeLine(0, 24, '|') },0);
                    setTimeout(function() { oled.writeLine(0, 24, '/') },250);
                    setTimeout(function() { oled.writeLine(0, 24, '-') },500);
                    setTimeout(function() { oled.writeLine(0, 24, '\\') },750);
                }, 1000);

            }, function(error) {
                console.log('Could not authenticate: '+error);
            }
        );
    }
);

function impulse() {
    var Steps = c['Store']['Steps'];
    var StepsNow = Math.floor((c['Store']['Interval'] * 1000 / (c['Store']['Monoflop']+c['Store']['MonoflopBrake']))*0.9);
    if(Steps > 0) {
        if(StepsNow > Steps) { 
            StepsNow = Steps; 
        }
        for(var i = 1;i<=StepsNow;i++) {
            setTimeout(function() {
                oled.writeLine(6, 0, 'Run Steps: '+StepsNow+'               ');
                if(c['Store']['StepDir'] == '-') {
                    iqr.setValue(9);
                    oled.writeLine(7, 0, 'Trigger +');
                    setTimeout(function() { 
                        iqr.setValue(0);
                        oled.writeLine(7, 0, 'Trigger 0');
                    }, c['Store']['Monoflop']);
                    timer();
                    c['Store']['StepDir'] = "+";
                } else {
                    iqr.setValue(6);
                    oled.writeLine(7, 0, 'Trigger -');
                    setTimeout(function() { 
                        iqr.setValue(0);
                        oled.writeLine(7, 0, 'Trigger 0');
                    }, c['Store']['Monoflop']);
                    timer();
                    c['Store']['StepDir'] = "-";
                }
            }, (c['Store']['Monoflop']+c['Store']['MonoflopBrake'])*i);
        }     
        iqr.setValue(0);
    }
}

function timer() {
    var t = c['Store']['Ts'];
    if(t.m < 60) {
        t.m+=1;
    } else {
        if(t.h < 23) {
            t.h += 1;
            t.m = 0;
        } else {
            if(t.d < 31) {
                t.d += 1;
                t.h = 0;
                t.m = 0;
            } else {
                t.d = 1;
                t.h = 0;
                t.m = 0;
            }
        }
    }
    c['Store']['Ts'] = t;
    fs.writeFileSync('scs.tmp', JSON.stringify(c['Store']['Ts']), { flag: 'w' });
}

function time2string(a) {
    var d = a.d;
    if(d < 10) {
        d = '0'+d;
    }
    var h = a.h;
    if(h < 10) {
        h = '0'+h;
    }
    var m = a.m;
    if(m < 10) {
        m = '0'+m;
    }
    return h+':'+m+' ('+d+')';
}
