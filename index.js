const dgram = require('dgram')
const EventEmitter = require('events').EventEmitter
const ip = require('ip') // working with IP addresses
const net = require('net') // yeelight networking
const _ = require('lodash') // for string padding and object-getting

class Yeelight extends EventEmitter {
  constructor () {
    super()

    this.devices = []
    this.socket = dgram.createSocket('udp4') // udp bits

    process.nextTick(() => {
      // listen for messages
      this.socket.on('message', (message, address) => {
        // if we sent the message, ignore it
        if (ip.address() === address.address) {
          return
        }

        // handle socket discovery message
        this.handleDiscovery(message, address)
      })
    })
  }

  // listens on options.port
  listen () {
    try {
      this.socket.bind(options.port, () => {
        this.socket.setBroadcast(true)
      })

      this.emit('ready', options.port)
    } catch (ex) {
      throw ex
    }
  }

  // discover() sends out a broadcast message to find all available devices.
  discover () {
    const message = options.discoveryMsg
    this.sendMessage(message, options.multicastAddr)
  }

  connect (device) {
    if (device.connected === false && device.socket === null) {
      device.socket = new net.Socket()

      device.socket.connect(device.port, device.host, () => {
        device.connected = true

        this.emit('deviceconnected', device)
      })

      device.socket.on('error', (error) => { // eslint-disable-line
        // intentionally left empty
        // todo: handle errors properly
      })

      device.socket.on('close', () => {
        device.socket.destroy()
        this.emit('devicedisconnected', device)
        device.connected = false
        device.socket = null
      })
    }
  }

  sendMessage (message, address, callback) {
    const buffer = Buffer.from(message) // todo check if this works
    this.socket.send(buffer, 0, buffer.length, options.port, address, (err, bytes) => {
      if (err) throw err
    })
  }

  handleDiscovery (message, address) {
    const headers = message.toString().split('\r\n')
    const device = {}

    // set defaults
    device.connected = false
    device.socket = null

    // build device params
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].indexOf('id:') >= 0) { device.id = headers[i].slice(4) }
      if (headers[i].indexOf('Location:') >= 0) {
        device.location = headers[i].slice(10)
        const tmp = device.location.split(':')
        device.host = tmp[1].replace('//', '')
        device.port = parseInt(tmp[2], 10)
      }
      if (headers[i].indexOf('power:') >= 0) { device.power = headers[i].slice(7) }
      if (headers[i].indexOf('bright:') >= 0) { device.brightness = headers[i].slice(8) }
      if (headers[i].indexOf('model:') >= 0) { device.model = headers[i].slice(7) }
      if (headers[i].indexOf('rgb:') >= 0) {
        const rgbDec = headers[i].slice(5)
        if (rgbDec > 0) {
          device.rgb = [
            (rgbDec >> 16) & 0xff,
            (rgbDec >> 8) & 0xff,
            rgbDec & 0xff
          ]
        }
      }
      if (headers[i].indexOf('hue:') >= 0) { device.hue = headers[i].slice(5) }
      if (headers[i].indexOf('sat:') >= 0) { device.saturation = headers[i].slice(5) }
    }

    this.addDevice(device)
  }

  addDevice (device) {
    // check if device exists in array
    if (_.filter(this.devices, { id: device.id }).length > 0) {
      // check if existing object is exactly the same as the device we're passing it
      if (_.isEqual(device, _.filter(this.devices, {
        id: device.id
      }))) {
        // don't do anything else
        return
      }

      // get our device from the list
      const index = _.findIndex(this.devices, { id: device.id })

      if (index !== -1) {
        // overwrite the device
        this.devices[index] = device
      }

      this.emit('deviceupdated', device)
    } else {
      // if device isn't in list
      // push new device into array
      this.devices.push(device)
      this.emit('deviceadded', device)
    }
  }

  setPower (device, state, speed) {
    speed = speed || 300

    const onOff = state === true ? 'on' : 'off'
    device.power = onOff

    const request = {
      id: 1,
      method: 'set_power',
      params: [onOff, 'smooth', speed]
    }

    this.sendCommand(device, request, (device) => {
      this.emit('powerupdated', device)
    })
  }

  setBrightness (device, percentage, speed) {
    speed = speed || 300

    if (device.power === 'off') {
      device.brightness = '0'
      this.setPower(device, true, 0)
    }

    device.brightness = percentage

    const request = {
      id: 1,
      method: 'set_bright',
      params: [percentage, 'smooth', speed]
    }

    this.sendCommand(device, request, (device) => {
      this.emit('brightnessupdated', device)
    })
  }

  setRGB (device, rgb, speed) {
    speed = speed || 300

    const rgbDec = (rgb[0] * 65536) + (rgb[1] * 256) + rgb[2]

    device.rgb = rgbDec

    const request = {
      id: 1,
      method: 'set_rgb',
      params: [rgbDec, 'smooth', speed]
    }

    this.sendCommand(device, request, (device) => {
      this.emit('rgbupdated', device)
    })
  }

  sendCommand (device, command, callback) {
    if (device.connected === false && device.socket === null) {
      console.log('Connection broken ' + device.connected + '\n' + device.socket)
      this.emit('devicedisconnected', device)
      return
    }

    const message = JSON.stringify(command)

    device.socket.write(message + '\r\n', 'utf8', () => {
      if (typeof callback !== 'undefined') {
        callback(device)
      }
    })
  }
}

const options = {
  port: 1982,
  multicastAddr: '239.255.255.250',
  discoveryMsg: 'M-SEARCH * HTTP/1.1\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n'
}

module.exports = Yeelight
