// working with IP addresses
var ip = require('ip');
// for string padding and object-getting
var _ = require('lodash');

// inherit event emitter
var util = require('util');
var EventEmitter = require('events').EventEmitter;
util.inherits(Yeelight, EventEmitter);

// udp bits
var dgram = require('dgram');
var socket = dgram.createSocket('udp4');

// yeelight networking 
var net = require('net');

function Yeelight() {
	EventEmitter.call(this);

	process.nextTick(function() {

		// listen for messages
		socket.on('message', function(message, address) {
			// if we sent the message, ignore it
			if (ip.address() == address.address) {
				return;
			}

			// handle socket discovery message
			this.handleDiscovery(message, address);

		}.bind(this));

	}.bind(this));
};

// listens on options.port
Yeelight.prototype.listen = function() {
	try {
		socket.bind(options.port, function() {
			socket.setBroadcast(true);
		});

		this.emit('ready', options.port);
	} catch (ex) {
		throw ex;
	}
};

// discover() sends out a broadcast message to find all available devices.
Yeelight.prototype.discover = function() {
	var message = options.discoveryMsg;
	this.sendMessage(message, options.multicastAddr);
};

Yeelight.prototype.connect = function(device) {
	if (device.connected === false && device.socket === null) {
		device.socket = new net.Socket();

		device.socket.connect(device.port, device.host, function() {
			device.connected = true;

			this.emit('deviceconnected', device);
		}.bind(this));
	}
};

Yeelight.prototype.sendMessage = function(message, address, callback) {
	var buffer = new Buffer(message);
	socket.send(buffer, 0, buffer.length, options.port, address, function(err, bytes) {
		if (err) throw err;
	});
};

Yeelight.prototype.handleDiscovery = function(message, address) {
	var headers = message.toString().split('\r\n');
	var device = {};

	// set defaults
	device.connected = false;
	device.socket = null;

	// build device params
	for (var i = 0; i < headers.length; i++) {
		if (headers[i].indexOf("id:") >= 0)
			device.id = headers[i].slice(4);
		if (headers[i].indexOf("Location:") >= 0) {
			device.location = headers[i].slice(10);
			var tmp = device.location.split(':');
			device.host = tmp[1].replace('//', '');
			device.port = parseInt(tmp[2], 10);
		}
		if (headers[i].indexOf("power:") >= 0)
			device.power = headers[i].slice(7);
		if (headers[i].indexOf("bright:") >= 0)
			device.brightness = headers[i].slice(8);
		if (headers[i].indexOf("model:") >= 0)
			device.model = headers[i].slice(7);
        if (headers[i].indexOf("rgb:") >= 0)
            device.rgb = headers[i].slice(5);
		if (headers[i].indexOf("hue:") >= 0)
			device.hue = headers[i].slice(5);
		if (headers[i].indexOf("sat:") >= 0)
			device.saturation = headers[i].slice(5);
	}

	this.addDevice(device);
};

Yeelight.prototype.addDevice = function(device) {
	// check if device exists in array
	if (_.filter(this.devices, {
		id: device.id
    }).length > 0) {
		// check if existing object is exactly the same as the device we're passing it
		if (_.isEqual(device, _.filter(this.devices, {
	        id: device.id
	      }))) {
	      // don't do anything else
	      return;
	    }

	    // get our device from the list
	    var dev = _.filter(this.devices, {
        	id: device.id
      	});

	    // overwrite the device
      	dev = device;
      	this.emit('deviceupdated', device);
	} 
	// if device isn't in list
	else {
		// push new device into array
    	this.devices.push(device);
    	this.emit('deviceadded', device);
	}
};

Yeelight.prototype.setPower = function(device, state, speed) {	
	speed = speed || 300;

	var on_off = state === true ? 'on' : 'off';
	device.power = on_off;

	var request = {
		id: 1,
		method: 'set_power',
		params: [on_off, 'smooth', speed]
	};

	this.sendCommand(device, request, function(device) {
		this.emit('powerupdated', device);
	}.bind(this));
};

Yeelight.prototype.setBrightness = function(device, percentage, speed) {
	speed = speed || 300;

	if (device.power == 'off') {
		device.brightness = '0';
		this.setPower(device, true, 0);
	}

	device.brightness = percentage;

	var request = {
		id: 1,
		method: 'set_bright',
		params: [percentage, 'smooth', speed]
	};

	this.sendCommand(device, request, function(device) {
		this.emit('brightnessupdated', device);
	}.bind(this));
};

Yeelight.prototype.setRGB = function(device, rgb, speed) {
    speed = speed || 300;

    rgb = rgb.split(',').map(Number);
    var rgb_dec = (rgb[0] * 65536) + (rgb[1] * 256) + rgb[2];

    device.rgb = rgb_dec;

    var request = {
        id: 1,
        method: 'set_rgb',
        params: [rgb_dec, 'smooth', speed]
    };

    this.sendCommand(device, request, function(device) {
        this.emit('rgbupdated', device);
    }.bind(this));
};

Yeelight.prototype.sendCommand = function(device, command, callback) {
	if (device.connected === false && device.socket === null) {
		console.log('Connection broken ' + device.connected + '\n' + device.socket);
		this.emit('devicedisconnected', device);
	    return;
	}

	var message = JSON.stringify(command);

	device.socket.write(message + '\r\n');

	if (typeof callback !== 'undefined') {
		callback(device);
	}
};

Yeelight.prototype.devices = [];

var options = {
	port: 1982,
	multicastAddr: '239.255.255.250',
	discoveryMsg: 'M-SEARCH * HTTP/1.1\r\nMAN: \"ssdp:discover\"\r\nST: wifi_bulb\r\n'
};

module.exports = Yeelight;
