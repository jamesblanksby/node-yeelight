# node-yeelight

This package lets you control Xiaomi Yeelight WiFi enabled smart light bulbs.

## Features

- Discover and connect to smart light bulbs
- Turn smart light bulbs on and off

## Supported Devices

This library has only been tested on the following device:

- Original Xiaomi Mi Yeelight E27 - [available at Banggood](http://www.banggood.com/Original-Xiaomi-Mi-Yeelight-E27-8W-White-LED-Smart-Light-Bulb-Smartphone-App-WIFI-Control-220V-p-1032314.html?rmmds=myorder)

There is no reason why it shouldn't work with the RGB version of Yeelight - let me know your mileage.

## Usage

### Installation

Install using [npm](https://www.npmjs.com/): `npm i --save node-yeelight`

### Discovering Devices

```javascript
var Yeelight = require('node-yeelight');
var y = new Yeelight;

y.on('ready', function() {
	y.discover(); // scan network for active Yeelights
});

y.listen();
```

### Connecting To Devices

```javascript
// listen for device added event
y.on('deviceadded', function(device) {
  y.connect(device); // attempt to connect
});
```

### Controlling Devices

Before attempting to control any devices you must have completed device discovery and connection.

```javascript
y.on('deviceconnected', function(device) {

  // turn Yeelight on/off
  y.setPower(
    device, // device object
    true, // device state (true/false)
    300 // transition speed in ms
  );
  
  // set Yeelight brightness
  y.setBrightness(
    device, // device object
    50, // brightness percentage (1-100)
    300 // transition speed in ms
  );
  
  //set Yeelight RGB color
  yeelight.setRGB(
     device, // device object
     [255,255,255], // rgb code
     300 //transition speed in ms
  );
  
});
```

## Licence

(The MIT License)

Copyright (c) 2016 James Blanksby james@blanks.by

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
