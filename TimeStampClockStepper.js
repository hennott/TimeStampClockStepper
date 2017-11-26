var c = {};
c['Host'] = 'localhost';
c['Secret'] = 'secret';
c['PortBrowser'] = 4280;
c['PortServer'] = 4223;
c['Disp'] = {};
c['Disp']['Uid'] = 'XXX';
c['Switch'] = {};
c['Switch']['Uid'] = 'XXX';
c['Pub'] = {};
c['Prv'] = {};
c['Pub']['Interval'] = 10; // in s
c['Pub']['Monoflop'] = 500; // in ms
c['Pub']['MonoflopBrake'] = 500; // in ms
c['Pub']['IoNet'] = true;
c['Pub']['Ip'] = 'localhost';
c['Pub']['IoHost'] = 'io.XXX.de';
c['Prv']['IoPathConfig'] = '/io.php?Api=filestore&Container=XXX&Path=config.json&UserId=XXX&UserKey=XXX&Action='; 
c['Prv']['IoPathBeat'] = '/io.php?Api=filestore&Container=XXX&Path=beat.json&UserId=XXX&UserKey=XXX&Action=';

if(typeof require === 'function' ) {
    var tf = require('tinkerforge');
    var fs = require('fs')
    var http = require('http');
    var https = require('https');
    c['Port'] = c['PortServer'];
    var os = require('os');
    var net = os.networkInterfaces();
    //console.log(net);
    c['Pub']['Ip'] = net['wlan0'][0]['address'];
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
                //console.log('Authentication succeeded');

                oled.clearDisplay();
                oled.writeLine(0, 0, 'StampClockStepper');
                oled.writeLine(2, 0, 'Das System wird gestartet');
                iqr.setValue(0);
                c['Pub']['Tx'] = {};
                c['Pub']['TxL'] = 'IO   CLK: --               ';

                //if(c['Pub']['IoNet'] == true && c['Prv']['IoPathConfig'] !== undefined) {

                    setInterval(function () {
                         try {
                            if(c['Pub']['Tx'].d == undefined || c['Pub']['Tx'].h == undefined || c['Pub']['Tx'].m == undefined) {
                                var options = {
                                    host: c['Pub']['IoHost'],
                                    port: 443,
                                    path: c['Prv']['IoPathConfig']+'GetData',
                                    method: 'GET'
                                };

                                var req = https.request(options, function(res) {
                                    //console.log('STATUS: ' + res.statusCode);
                                    //console.log('HEADERS: ' + JSON.stringify(res.headers));
                                    res.setEncoding('utf8');
                                    res.on('data', function (data) {
                                        data = JSON.parse(data)
                                        if(data.d !== undefined && data.m !== undefined && data.h !== undefined) {
                                            c['Pub']['Tx'] = data;
                                            console.log('Get New Time from IOnet');
                                            var TxTxt = time2string(c['Pub']['Tx']);
                                            c['Pub']['TxL'] = 'IO > CLK: '+TxTxt+'               ';

                                            var options = {
                                                host: c['Pub']['IoHost'],
                                                port: 443,
                                                path: c['Prv']['IoPathConfig']+'SetData&Value={}',
                                                method: 'GET'
                                            };
                                            var req = https.request(options, function(res) {
                                                //console.log('STATUS: ' + res.statusCode);
                                                //console.log('HEADERS: ' + JSON.stringify(res.headers));
                                                res.setEncoding('utf8');
                                            }).end();
                                        }
                                    });
                                }).end();

                                //console.log(c['Pub']['Tx']);
                                oled.writeLine(5, 0, c['Pub']['TxL']);
                            }
                        } catch (err) {
                            c['Pub']['Tx'] = {};
                            c['Pub']['TxL'] = 'IO ! CLK: ERR               ';
                            oled.writeLine(5, 0, c['Pub']['TxL']);
                        }
                        
                    },10000);
                //}

                setInterval(function () {
                    //oled.clearDisplay();
                    oled.writeLine(0, 0, 'StampClockStepper v.29');
                    
                    var Tw = new Date();
                    c['Pub']['Tw'] = { "d":Tw.getDate(), "h":Tw.getHours(), "m":Tw.getMinutes()}
                    var TwTxt = time2string(c['Pub']['Tw']);
                    oled.writeLine(1, 0, 'Time NTP: '+TwTxt);

                    try {
                    	c['Pub']['scstmp'] = fs.readFileSync('scs.tmp', "utf8");
                    } catch (e) {
                    	c['Pub']['Ts'] = {'d':0,'h':0,'m':0};
                    	timer();
                    }
                    
                    try {
						c['Pub']['Ts'] = JSON.parse(c['Pub']['scstmp']);
                    } catch (e) {
                    	c['Pub']['Ts'] = {'d':0,'h':0,'m':0};
                    	timer();
                    }

                    //if(c['Pub']['IoNet'] == true && c['Pub']['IoPathConfig'] !== undefined) {
                        if(c['Pub']['Tx'].d !== undefined && c['Pub']['Tx'].h !== undefined && c['Pub']['Tx'].m !== undefined) {
                            //console.log('RESET TimeStamp');
                            c['Pub']['Ts'] = c['Pub']['Tx'];
                            var TxTxt = time2string(c['Pub']['Tx']);
                            c['Pub']['TxL'] = 'IO   CLK: '+TxTxt+'               ';
                            oled.writeLine(5, 0, c['Pub']['TxL']);
                        }
                    //}

                    var TsTxt = time2string(c['Pub']['Ts']);
                    oled.writeLine(2, 0, 'Time CLK: '+TsTxt+'               ');

                    var Steps = 0;
                    if((c['Pub']['Tw'].d - c['Pub']['Ts'].d) < 0) {
                        Steps += (31 - c['Pub']['Ts'].d + c['Pub']['Tw'].d) * 1440;
                    } else {
                        Steps += (c['Pub']['Tw'].d - c['Pub']['Ts'].d) * 1440;
                    }
                    
                    Steps += (c['Pub']['Tw'].h - c['Pub']['Ts'].h) * 60;
                    Steps += (c['Pub']['Tw'].m - c['Pub']['Ts'].m) * 1;
                    oled.writeLine(3, 0, 'Steps   : '+Steps.toString()+'               ');
                    c['Pub']['Steps'] = Steps;

                    //if(c['Pub']['IoNet'] == true && c['Pub']['IoPathBeat'] !== undefined) {
                        var StoreTxt = encodeURIComponent(JSON.stringify(c['Pub']));
                        var options = {
                            host: c['Pub']['IoHost'],
                            port: 443,
                            path: c['Prv']['IoPathBeat']+'SetData&Value='+StoreTxt, //{"Ts.d":"'+c['Pub']['Ts'].d+'"}',
                            method: 'GET'
                        };
                        //console.log(options);
                        var req = https.request(options, function(res) {
                            //console.log('STATUS: ' + res.statusCode);
                            //console.log('HEADERS: ' + JSON.stringify(res.headers));
                            res.setEncoding('utf8');
                        }).end();
                    //}

                    if(Steps > 0) {
                        impulse();
                    } else {
                        iqr.setValue(0);
                    }

                    oled.writeLine(4, 0, 'IP      : '+c['Pub']['Ip']+'               ');

                    oled.writeLine(6, 0, 'Standby                          ');
                    oled.writeLine(7, 0, '                                 ');
                    
                }, c['Pub']['Interval'] * 1000);

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
    var Steps = c['Pub']['Steps'];
    var StepsNow = Math.floor((c['Pub']['Interval'] * 1000 / (c['Pub']['Monoflop']+c['Pub']['MonoflopBrake']))*0.9);
    if(Steps > 0) {
        if(StepsNow > Steps) { 
            StepsNow = Steps; 
        }
        for(var i = 1;i<=StepsNow;i++) {
            setTimeout(function() {
                oled.writeLine(6, 0, 'Run Steps: '+StepsNow+'               ');
                if(c['Pub']['StepDir'] == '-') {
                    iqr.setValue(9);
                    oled.writeLine(7, 0, 'Trigger +');
                    setTimeout(function() { 
                        iqr.setValue(0);
                        oled.writeLine(7, 0, 'Trigger 0');
                    }, c['Pub']['Monoflop']);
                    timer();
                    c['Pub']['StepDir'] = "+";
                } else {
                    iqr.setValue(6);
                    oled.writeLine(7, 0, 'Trigger -');
                    setTimeout(function() { 
                        iqr.setValue(0);
                        oled.writeLine(7, 0, 'Trigger 0');
                    }, c['Pub']['Monoflop']);
                    timer();
                    c['Pub']['StepDir'] = "-";
                }
            }, (c['Pub']['Monoflop']+c['Pub']['MonoflopBrake'])*i);
        }     
        iqr.setValue(0);
    }
}

function timer() {
    var t = c['Pub']['Ts'];

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
    c['Pub']['Ts'] = t;
    fs.writeFileSync('scs.tmp', JSON.stringify(c['Pub']['Ts']), { flag: 'w' });
}

function time2string(a) {
    //console.log('time2string');
    try {
        if(a !== undefined && a.length !== 0 && a.d !== undefined && a.h !== undefined && a.m !== undefined) {
            //console.log(a);
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
        } else {
            return '--';
        }
    } catch (err) {
        console.log(err);
        return '--';
    }
}