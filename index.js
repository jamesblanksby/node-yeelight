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

function wrapDevice (device) {
  return new Proxy(device, {
    get (target, name) {
      switch (name) {
        // return custom attributes as is
        case 'properties':
        case 'socket':
        case 'connected':
          return target[name]

        // for compatibility with previous interface
        case 'host':
        case 'port': {
          const parsed = url.parse(target.properties.location)
          return name === 'host'
            ? parsed.hostname
            : parsed.port
        }

        // transform properties
        case 'rgb':
          return [
            (target.properties.rgb >> 16) & 0xff,
            (target.properties.rgb >> 8) & 0xff,
            (target.properties.rgb) & 0xff
          ]

        // pass through all other properties
        default:
          return target.properties[name]
      }
    },
    set (target, name, value) {
      switch (name) {
        case 'properties':
          Object.assign(target.properties, value)
          return true
        case 'socket':
        case 'connected':
          target[name] = value
          return true
        default:
          if (Object.keys(target.properties).indexOf(name) !== -1) {
            target.properties[name] = value
            return true
          }
          return false
      }
    }
  })
}

class Yeelight extends EventEmitter {
  constructor () {
    super()

    this.devices = []
    this.socket = dgram.createSocket('udp4', this.handleDiscovery.bind(this))
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
    this.socket.send(options.discoveryMsg, options.port, options.multicastAddr, (err) => {
      if (err) throw err // todo: handle error (what error?)
    })
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

  handleDiscovery (data, from) {
    // if we sent the message, ignore it
    if (ip.address() === from.address) {
      return
    }

    const deviceInfo = wrapDevice({
      properties: httpResponse(data.toString()).headers,
      connected: false,
      socket: null
    })

    this.addDevice(deviceInfo)
  }

  addDevice (device) {
    // check if device exists in array
    const existing = _.find(this.devices, { id: device.id })

    if (existing) {
      // check if existing object is exactly the same as the device we're trying to add
      if (_.isEqual(existing.properties, device.properties)) {
        return // do nothing
      }

      // the device was updated
      existing.properties = device.properties
      // todo: reconnect control socket if location has changed

      this.emit('deviceupdated')
      return
    }

    // if device isn't in list, push new device into array
    this.devices.push(device)
    this.emit('deviceadded', device)
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
