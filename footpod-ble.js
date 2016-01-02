var noble = require('noble');
var debug = require('debug')('footpod');

var rsc_service_uuid = 0x1814;
var rsc_measurement_characteristic_uuid = 0x2a53;
var rsc_feature_characteristic_uuid = 0x2a54;

var rsc_feature_characteristic = null;
var rsc_measurement_characteristic = null;
var features = null;

noble.on('stateChange', function(state){
  if (state === 'poweredOn') {
    debug('Bluetooth powered on');
    // it's faster not to provide the service uuid and do a full scan
    noble.startScanning([rsc_service_uuid.toString(16)], false);
  } else {
    debug('Bluetooth powered off');
    noble.stopScanning();
  }
});


noble.on('discover', function(peripheral) {
  debug('found peripheral:', peripheral.advertisement);
  noble.stopScanning();

  peripheral.connect(function(err) {
    if (err) {
      console.log("Error connecting to Bluetooth sensor: ", err);
      return;
    }
    debug('Connected to sensor');

    peripheral.discoverServices([], function (err, services) {
      if (err) {
        console.log("Error discovering sensor services: ", err);
        return;
      }
      services.forEach(function(service) {
        if (service.uuid === rsc_service_uuid.toString(16)) {
          debug('Found service:', service.uuid);
          service.discoverCharacteristics([], function (err, characteristics) {
            if (err) {
              console.log("Error discovering sensor characteristics: ", err);
              return;
            }
            characteristics.forEach(function(characteristic) {
              var uuid = parseInt(characteristic.uuid, 16);
              debug('Found characteristic:', uuid.toString(16));
              if (uuid === rsc_feature_characteristic_uuid) {
                rsc_feature_characteristic = characteristic;
              } else if (uuid === rsc_measurement_characteristic_uuid) {
                rsc_measurement_characteristic = characteristic;
              }
            });
            if (rsc_feature_characteristic && rsc_measurement_characteristic) {
              // we got the characteristics, now we are ready to read data
              debug('Found characteristics');
              // let's get the features
              rsc_feature_characteristic.read(function(err, data) {
                if (err) {
                  console.log("Error reading sensor features: ", err);
                  return;
                }
                if (data) {
                  features = data.readInt16LE(0);
                  debug('Sensor features: ', features);
                  // we only use the mandatory features, but if necessary
                  // we could check that we have the necessary features
                  // before registering to the notification:
                  // 000001 - 0x001 - Instantaneous Stride Length Measurement Supported
                  // 000010 - 0x002 - Total Distance Measurement Supported
                  // 000100 - 0x004 - Walking or Running Status Supported
                  // 001000 - 0x008 - Calibration Procedure Supported
                  // 010000 - 0x010 - Multiple Sensor Locations Supported
                  rsc_measurement_characteristic.on('read', function(data, isNotification) {
                    // 8 bit -> flags
                    //    0001 - 0x01 - Instantaneous Stride Length Present
                    //    0010 - 0x02 - Total Distance Present
                    //    0100 - 0x04 - Walking or Running Status
                    // uint16 -> instantaneous speed (mandatory)
                    // uint8 -> instantaneous cadence (mandatory)
                    // uint16 -> instantaneous stride length (if in flag)
                    var flags = data.readUInt8(0);
                    debug('Flags: ', flags);
                    var speed = data.readUInt16LE(1);
                    debug('Speed: ', speed);
                    var cadence = data.readUInt8(3);
                    debug('Cadence: ', cadence);
                    // TODO broadcast back to BLE cycling
                  });
                  rsc_measurement_characteristic.notify(true, function(err) {
                    if (err) {
                      console.log("Error subscribing to sensor measurements: ", err);
                      return;
                    }
                  });
                }
              });
            }
          });
        }
      });
    });
  });
});
