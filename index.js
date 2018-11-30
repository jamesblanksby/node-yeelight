const dgram = require('dgram')
const EventEmitter = require('events').EventEmitter
const ip = require('ip') // working with IP addresses
const net = require('net') // yeelight networking
const url = require('url')

const _ = require('lodash') // for string padding and object-getting
const httpResponse = require('http-headers')

const options = {
  port: 1982,
  multicastAddr: '239.255.255.250',
  discoveryMsg: 'M-SEARCH * HTTP/1.1\r\nMAN: "ssdp:discover"\r\nST: wifi_bulb\r\n'
}

class Yeelight extends EventEmitter {
  constructor () {
    super()

    this.devices = []
    this.socket = dgram.createSocket('udp4', this.handleDiscovery.bind(this)) // udp bits
  }

  /**
   * Listen for search responses and state refresh messages.
   */
  listen () {
    try {
      this.socket.bind(options.port, () => {
        this.socket.setBroadcast(true)
        this.emit('ready', options.port)
      })
    } catch (ex) {
      throw ex
    }
  }

  /**
   * Send a search request to discover available devices.
   */
  discover () {
    const message = options.discoveryMsg
    this.sendMessage(message, options.multicastAddr)
  }

  /**
   * Establish control connection to a device.
   * @param device
   */
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
    // if we sent the message, ignore it
    if (ip.address() === address.address) {
      return
    }

    const headers = httpResponse(message.toString()).headers
    const device = {}

    // set defaults
    device.connected = false
    device.socket = null

    device.id = headers.id
    device.location = headers.location

    const parsedUrl = url.parse(headers.location)
    device.host = parsedUrl.hostname
    device.port = parsedUrl.port

    device.power = headers.power
    device.brightness = headers.bright
    device.model = headers.model

    device.rgb = [
      (headers.rgb >> 16) & 0xff,
      (headers.rgb >> 8) & 0xff,
      (headers.rgb) & 0xff
    ]

    device.hue = headers.hue
    device.sat = headers.sat

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

module.exports = Yeelight
