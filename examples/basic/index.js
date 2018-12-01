const Yeelight = require('../../index.js')
const y = new Yeelight()

y.on('ready', function () {
  console.log('ready')
  y.discover()
})

y.on('deviceadded', function (device) {
  console.log('device added')

  y.connect(device)
})

y.on('deviceconnected', function (device) {
  console.log('device connected')

  let state = true
  setInterval(function () {
    y.setPower(device, state, 300)

    state = !state
  }, 3000)
})

y.listen()
