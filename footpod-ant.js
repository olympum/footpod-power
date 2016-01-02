var peripheral = require('ble-cycling-power');
var ble = new peripheral.BluetoothPeripheral('WaterRower S4');
var Ant = require('ant-plus');

var stick = new Ant.GarminStick2;

var sensor2 = new Ant.StrideSpeedDistanceSensor(stick);

var last_time = 0;
var last_distance = 0;

sensor2.on('ssddata', function (data) {
  var new_time = data.TimeInteger + data.TimeFractional/1000;
  var time = new_time - last_time;
  if (time < 1) {
    return;
  }

  //console.log('sensor 2: ', data.DeviceID, data);
  var new_distance = data.DistanceInteger + data.DistanceFractional/1000;
  var distance = new_distance - last_distance;
  last_time = new_time;
  last_distance = new_distance;
  var power = 74 * distance^2 / time^3;
  var event = {'power': power, 'rev_count': data.StrideCount};
  console.log('power: %j', event);
  ble.notify({
    'watts': power,
    'rev_count': data.StrideCount
  });
});

sensor2.on('attached', function () { console.log('sensor2 attached'); });
sensor2.on('detached', function () { console.log('sensor2 detached'); });

stick.on('startup', function () {
        console.log('startup');

        console.log('Max channels:', stick.maxChannels);


        setTimeout(function (data) {
                sensor2.attach(1, 0);
        }, 2000);

});

stick.on('shutdown', function () { console.log('shutdown'); });

if (!stick.open()) {
        console.log('Stick not found!');
} else {
    console.log('stick found');

//        setTimeout(function () { stick.close(); }, 60000);
}
