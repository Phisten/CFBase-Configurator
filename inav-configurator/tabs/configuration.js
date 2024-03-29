'use strict';

TABS.configuration = {};

TABS.configuration.initialize = function (callback, scrollPosition) {
    var self = this;

    if (GUI.active_tab != 'configuration') {
        GUI.active_tab = 'configuration';
        googleAnalytics.sendAppView('Configuration');
    }

    function load_config() {
        MSP.send_message(MSP_codes.MSP_BF_CONFIG, false, false, load_serial_config);
    }

    function load_serial_config() {
        var next_callback = load_rc_map;
        if (semver.lt(CONFIG.apiVersion, "1.6.0")) {
            MSP.send_message(MSP_codes.MSP_CF_SERIAL_CONFIG, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function load_rc_map() {
        MSP.send_message(MSP_codes.MSP_RX_MAP, false, false, load_misc);
    }

    function load_misc() {
        MSP.send_message(MSP_codes.MSP_MISC, false, false, load_arming_config);
    }

    function load_arming_config() {
        var next_callback = load_loop_time;
        if (semver.gte(CONFIG.apiVersion, "1.8.0")) {
            MSP.send_message(MSP_codes.MSP_ARMING_CONFIG, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function load_loop_time() {
        var next_callback = load_rx_config;
        if (semver.gte(CONFIG.apiVersion, "1.8.0")) {
            MSP.send_message(MSP_codes.MSP_LOOP_TIME, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function load_rx_config() {
        var next_callback = load_3d;
        if (semver.gte(CONFIG.apiVersion, "1.21.0")) {
            MSP.send_message(MSP_codes.MSP_RX_CONFIG, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function load_3d() {
        var next_callback = load_sensor_alignment;
        if (semver.gte(CONFIG.apiVersion, "1.14.0")) {
            MSP.send_message(MSP_codes.MSP_3D, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function load_sensor_alignment() {
        var next_callback = loadAdvancedConfig;
        if (semver.gte(CONFIG.apiVersion, "1.15.0")) {
            MSP.send_message(MSP_codes.MSP_SENSOR_ALIGNMENT, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function loadAdvancedConfig() {
        var next_callback = loadINAVPidConfig;
        if (semver.gte(CONFIG.flightControllerVersion, "1.3.0")) {
            MSP.send_message(MSP_codes.MSP_ADVANCED_CONFIG, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    function loadINAVPidConfig() {
        var next_callback = load_html;
        if (semver.gt(CONFIG.flightControllerVersion, "1.3.0")) {
            MSP.send_message(MSP_codes.MSP_INAV_PID, false, false, next_callback);
        } else {
            next_callback();
        }
    }

    //Update Analog/Battery Data
    function load_analog() {
        MSP.send_message(MSP_codes.MSP_ANALOG, false, false, function () {
	    $('input[name="batteryvoltage"]').val([ANALOG.voltage.toFixed(1)]);
	    $('input[name="batterycurrent"]').val([ANALOG.amperage.toFixed(2)]);
            });
    }

    function load_html() {
        $('#content').load("./tabs/configuration.html", process_html);
    }

    MSP.send_message(MSP_codes.MSP_IDENT, false, false, load_config);

    function process_html() {

        var mixer_list_e = $('select.mixerList');
        for (var i = 0; i < mixerList.length; i++) {
            mixer_list_e.append('<option value="' + (i + 1) + '">' + mixerList[i].name + '</option>');
        }

        mixer_list_e.change(function () {
            var val = parseInt($(this).val());

            BF_CONFIG.mixerConfiguration = val;

            $('.mixerPreview img').attr('src', './resources/motor_order/' + mixerList[val - 1].image + '.svg');
        });

        // select current mixer configuration
        mixer_list_e.val(BF_CONFIG.mixerConfiguration).change();

        // generate features
        var features = FC.getFeatures();

        var radioGroups = [];

        var features_e = $('.features');
        for (var i = 0; i < features.length; i++) {
            var row_e;

            var feature_tip_html = '';
            if (features[i].haveTip) {
                feature_tip_html = '<div class="helpicon cf_tip" i18n_title="feature' + features[i].name + 'Tip"></div>';
            }

            if (features[i].mode === 'group') {
                row_e = $('<tr><td style="width: 15px;"><input style="width: 13px;" class="feature" id="feature-'
                        + i
                        + '" value="'
                        + features[i].bit
                        + '" title="'
                        + features[i].name
                        + '" type="radio" name="'
                        + features[i].group
                        + '" /></td><td><label for="feature-'
                        + i
                        + '">'
                        + features[i].name
                        + '</label></td><td><span i18n="feature' + features[i].name + '"></span>'
                        + feature_tip_html + '</td></tr>');
                radioGroups.push(features[i].group);
            } else {
                row_e = $('<tr><td><input class="feature toggle"'
                        + i
                        + '" name="'
                        + features[i].name
                        + '" title="'
                        + features[i].name
                        + '" type="checkbox"/></td><td><label for="feature-'
                        + i
                        + '">'
                        + features[i].name
                        + '</label></td><td><span i18n="feature' + features[i].name + '"></span>'
                        + feature_tip_html + '</td></tr>');

                var feature_e = row_e.find('input.feature');

                feature_e.prop('checked', bit_check(BF_CONFIG.features, features[i].bit));
                feature_e.data('bit', features[i].bit);
            }

            features_e.each(function () {
                if ($(this).hasClass(features[i].group)) {
                    $(this).append(row_e);
                }
            });
        }

        // translate to user-selected language
        localize();

        for (var i = 0; i < radioGroups.length; i++) {
            var group = radioGroups[i];
            var controls_e = $('input[name="' + group + '"].feature');


            controls_e.each(function() {
                var bit = parseInt($(this).attr('value'));
                var state = bit_check(BF_CONFIG.features, bit);

                $(this).prop('checked', state);
            });
        }


        var alignments = [
            'CW 0°',
            'CW 90°',
            'CW 180°',
            'CW 270°',
            'CW 0° flip',
            'CW 90° flip',
            'CW 180° flip',
            'CW 270° flip'
        ];

        var orientation_gyro_e = $('select.gyroalign');
        var orientation_acc_e = $('select.accalign');
        var orientation_mag_e = $('select.magalign');

        if (semver.lt(CONFIG.apiVersion, "1.15.0")) {
            $('.tab-configuration .sensoralignment').hide();
        } else {
            for (var i = 0; i < alignments.length; i++) {
                orientation_gyro_e.append('<option value="' + (i+1) + '">'+ alignments[i] + '</option>');
                orientation_acc_e.append('<option value="' + (i+1) + '">'+ alignments[i] + '</option>');
                orientation_mag_e.append('<option value="' + (i+1) + '">'+ alignments[i] + '</option>');
            }
            orientation_gyro_e.val(SENSOR_ALIGNMENT.align_gyro);
            orientation_acc_e.val(SENSOR_ALIGNMENT.align_acc);
            orientation_mag_e.val(SENSOR_ALIGNMENT.align_mag);
        }


        // generate GPS
        var gpsProtocols = [
            'NMEA',
            'UBLOX',
            'I2C-NAV',
            'DJI NAZA',
        ];

        var gpsBaudRates = [
            '115200',
            '57600',
            '38400',
            '19200',
            '9600',
			'4800'
        ];

        var gpsSbas = [
            'Autodetect',
            'European EGNOS',
            'North American WAAS',
            'Japanese MSAS',
            'Indian GAGAN',
            'Disabled',
        ];

        var gps_protocol_e = $('select.gps_protocol');
        for (var i = 0; i < gpsProtocols.length; i++) {
            gps_protocol_e.append('<option value="' + i + '">' + gpsProtocols[i] + '</option>');
        }

        gps_protocol_e.change(function () {
            MISC.gps_type = parseInt($(this).val());
        });

        gps_protocol_e.val(MISC.gps_type);


        var gps_baudrate_e = $('select.gps_baudrate');
        for (var i = 0; i < gpsBaudRates.length; i++) {
            gps_baudrate_e.append('<option value="' + gpsBaudRates[i] + '">' + gpsBaudRates[i] + '</option>');
        }

        if (semver.lt(CONFIG.apiVersion, "1.6.0")) {
            gps_baudrate_e.change(function () {
                SERIAL_CONFIG.gpsBaudRate = parseInt($(this).val());
            });
            gps_baudrate_e.val(SERIAL_CONFIG.gpsBaudRate);
        } else {
            gps_baudrate_e.prop("disabled", true);
            gps_baudrate_e.parent().hide();
        }

        var gps_ubx_sbas_e = $('select.gps_ubx_sbas');
        for (var i = 0; i < gpsSbas.length; i++) {
            gps_ubx_sbas_e.append('<option value="' + i + '">' + gpsSbas[i] + '</option>');
        }

        gps_ubx_sbas_e.change(function () {
            MISC.gps_ubx_sbas = parseInt($(this).val());
        });

        gps_ubx_sbas_e.val(MISC.gps_ubx_sbas);


        // generate serial RX
        var serialRXtypes = [
            'SPEKTRUM1024',
            'SPEKTRUM2048',
            'SBUS',
            'SUMD',
            'SUMH',
            'XBUS_MODE_B',
            'XBUS_MODE_B_RJ01',
            'IBUS'
        ];

        var serialRX_e = $('select.serialRX');
        for (var i = 0; i < serialRXtypes.length; i++) {
            serialRX_e.append('<option value="' + i + '">' + serialRXtypes[i] + '</option>');
        }

        serialRX_e.change(function () {
            RX_CONFIG.serialrx_provider = parseInt($(this).val());
        });

        // select current serial RX type
        serialRX_e.val(RX_CONFIG.serialrx_provider);

        // for some odd reason chrome 38+ changes scroll according to the touched select element
        // i am guessing this is a bug, since this wasn't happening on 37
        // code below is a temporary fix, which we will be able to remove in the future (hopefully)
        $('#content').scrollTop((scrollPosition) ? scrollPosition : 0);

        var nrf24Protocoltypes = [
            'V202 250Kbps',
            'V202 1Mbps',
            'Syma X',
            'Syma X5C',
            'Cheerson CX10',
            'Cheerson CX10A',
            'JJRC H8_3D',
            'iNav Reference protocol'
        ];

        var nrf24Protocol_e = $('select.nrf24Protocol');
        for (var i = 0; i < nrf24Protocoltypes.length; i++) {
            nrf24Protocol_e.append('<option value="' + i + '">' + nrf24Protocoltypes[i] + '</option>');
        }

        nrf24Protocol_e.change(function () {
            RX_CONFIG.nrf24rx_protocol = parseInt($(this).val());
            RX_CONFIG.nrf24rx_id = 0;
        });

        // select current nrf24 protocol
        nrf24Protocol_e.val(RX_CONFIG.nrf24rx_protocol);

        // fill board alignment
        $('input[name="board_align_roll"]').val((BF_CONFIG.board_align_roll / 10.0).toFixed(1));
        $('input[name="board_align_pitch"]').val((BF_CONFIG.board_align_pitch / 10.0).toFixed(1));
        $('input[name="board_align_yaw"]').val((BF_CONFIG.board_align_yaw / 10.0).toFixed(1));

        // fill magnetometer
        $('input[name="mag_declination"]').val(MISC.mag_declination);

        //fill motor disarm params and FC loop time
        if(semver.gte(CONFIG.apiVersion, "1.8.0")) {
            $('input[name="autodisarmdelay"]').val(ARMING_CONFIG.auto_disarm_delay);
            $('input[name="disarmkillswitch"]').prop('checked', ARMING_CONFIG.disarm_kill_switch);
            $('div.disarm').show();
            if(bit_check(BF_CONFIG.features, 4))//MOTOR_STOP
                $('div.disarmdelay').show();
            else
                $('div.disarmdelay').hide();

        }

        // fill throttle
        $('input[name="minthrottle"]').val(MISC.minthrottle);
        $('input[name="midthrottle"]').val(MISC.midrc);
        $('input[name="maxthrottle"]').val(MISC.maxthrottle);
        $('input[name="mincommand"]').val(MISC.mincommand);

        // fill battery
        $('input[name="mincellvoltage"]').val(MISC.vbatmincellvoltage);
        $('input[name="maxcellvoltage"]').val(MISC.vbatmaxcellvoltage);
        $('input[name="warningcellvoltage"]').val(MISC.vbatwarningcellvoltage);
        $('input[name="voltagescale"]').val(MISC.vbatscale);

        // fill current
        $('input[name="currentscale"]').val(BF_CONFIG.currentscale);
        $('input[name="currentoffset"]').val(BF_CONFIG.currentoffset);
        $('input[name="multiwiicurrentoutput"]').prop('checked', MISC.multiwiicurrentoutput);

        var escProtocols = {
            0: {
                name: "STANDARD",
                defaultRate: 400,
                rates: {
                    50: "50Hz",
                    400: "400Hz"
                }
            },
            1: {
                name: "ONESHOT125",
                defaultRate: 1000,
                rates: {
                    400: "400Hz",
                    1000: "1kHz",
                    2000: "2kHz"
                }
            },
            2: {
                name: "ONESHOT42",
                defaultRate: 2000,
                rates: {
                    400: "400Hz",
                    1000: "1kHz",
                    2000: "2kHz",
                    4000: "4kHz",
                    8000: "8kHz"
                }
            },
            3: {
                name: "MULTISHOT",
                defaultRate: 2000,
                rates: {
                    400: "400Hz",
                    1000: "1kHz",
                    2000: "2kHz",
                    4000: "4kHz",
                    8000: "8kHz"
                }
            },
            4: {
                name: "BRUSHED",
                defaultRate: 8000,
                rates: {
                    8000: "8kHz",
                    16000: "16kHz",
                    32000: "32kHz"
                }
            }
        };

        var servoRates = {
            50: "50Hz",
            60: "60Hz",
            100: "100Hz",
            200: "200Hz",
            400: "400Hz"
        };

        function buildMotorRates() {
            var protocolData = escProtocols[ADVANCED_CONFIG.motorPwmProtocol];

            $escRate.find('option').remove();

            for (var i in protocolData.rates) {
                if (protocolData.rates.hasOwnProperty(i)) {
                    $escRate.append('<option value="' + i + '">' + protocolData.rates[i] + '</option>');
                }
            }

            /*
             *  If rate from FC is not on the list, add a new entry
             */
            if ($escRate.find('[value="' + ADVANCED_CONFIG.motorPwmRate + '"]').length == 0) {
                $escRate.append('<option value="' + ADVANCED_CONFIG.motorPwmRate + '">' + ADVANCED_CONFIG.motorPwmRate + 'Hz</option>');
            }

        }

        if (semver.gte(CONFIG.flightControllerVersion, "1.3.0")) {

            var $escProtocol = $('#esc-protocol');
            var $escRate = $('#esc-rate');
            for (var i in escProtocols) {
                if (escProtocols.hasOwnProperty(i)) {
                    var protocolData = escProtocols[i];
                    $escProtocol.append('<option value="' + i + '">' + protocolData.name + '</option>');
                }
            }

            buildMotorRates();
            $escProtocol.val(ADVANCED_CONFIG.motorPwmProtocol);
            $escRate.val(ADVANCED_CONFIG.motorPwmRate);

            $escProtocol.change(function () {
                ADVANCED_CONFIG.motorPwmProtocol = $(this).val();
                buildMotorRates();
                ADVANCED_CONFIG.motorPwmRate = escProtocols[ADVANCED_CONFIG.motorPwmProtocol].defaultRate;
                $escRate.val(ADVANCED_CONFIG.motorPwmRate);
            });

            $escRate.change(function () {
                ADVANCED_CONFIG.motorPwmRate = $(this).val();
            });

            $("#esc-protocols").show();

            var $servoRate = $('#servo-rate');

            for (var i in servoRates) {
                if (servoRates.hasOwnProperty(i)) {
                    $servoRate.append('<option value="' + i + '">' + servoRates[i] + '</option>');
                }
            }
            /*
             *  If rate from FC is not on the list, add a new entry
             */
            if ($servoRate.find('[value="' + ADVANCED_CONFIG.servoPwmRate + '"]').length == 0) {
                $servoRate.append('<option value="' + ADVANCED_CONFIG.servoPwmRate + '">' + ADVANCED_CONFIG.servoPwmRate + 'Hz</option>');
            }

            $servoRate.val(ADVANCED_CONFIG.servoPwmRate);
            $servoRate.change(function () {
                ADVANCED_CONFIG.servoPwmRate = $(this).val();
            });

            $('#servo-rate-container').show();
        }

        var gyroLpfValues = FC.getGyroLpfValues();
        var looptimes = FC.getLooptimes();
        var $looptime = $("#looptime");

        if (semver.gte(CONFIG.flightControllerVersion, "1.4.0")) {

            var $gyroLpf = $("#gyro-lpf"),
                $gyroSync = $("#gyro-sync-checkbox");

            for (var i in gyroLpfValues) {
                if (gyroLpfValues.hasOwnProperty(i)) {
                    $gyroLpf.append('<option value="' + i + '">' + gyroLpfValues[i].label + '</option>');
                }
            }

            $gyroLpf.val(INAV_PID_CONFIG.gyroscopeLpf);
            $gyroSync.prop("checked", ADVANCED_CONFIG.gyroSync);

            $gyroLpf.change(function () {
                INAV_PID_CONFIG.gyroscopeLpf = $gyroLpf.val();

                $looptime.find("*").remove();
                var looptimeOptions = looptimes[gyroLpfValues[INAV_PID_CONFIG.gyroscopeLpf].tick];
                for (var i in looptimeOptions.looptimes) {
                    if (looptimeOptions.looptimes.hasOwnProperty(i)) {
                        $looptime.append('<option value="' + i + '">' + looptimeOptions.looptimes[i] + '</option>');
                    }
                }
                $looptime.val(looptimeOptions.defaultLooptime);
                $looptime.change();
            });

            $gyroLpf.change()
            $looptime.val(FC_CONFIG.loopTime);

            $looptime.change(function () {
                if (INAV_PID_CONFIG.asynchronousMode == 0) {
                    //All task running together
                    FC_CONFIG.loopTime = $(this).val();
                    ADVANCED_CONFIG.gyroSyncDenominator = Math.floor(FC_CONFIG.loopTime / gyroLpfValues[INAV_PID_CONFIG.gyroscopeLpf].tick);
                } else {
                    //FIXME this is temporaty fix that gives the same functionality to ASYNC_MODE=GYRO and ALL
                    FC_CONFIG.loopTime = $(this).val();
                    ADVANCED_CONFIG.gyroSyncDenominator = Math.floor(FC_CONFIG.loopTime / gyroLpfValues[INAV_PID_CONFIG.gyroscopeLpf].tick);
                }
            });

            $looptime.change();

            $gyroSync.change(function () {
                if ($(this).is(":checked")) {
                    ADVANCED_CONFIG.gyroSync = 1;
                } else {
                    ADVANCED_CONFIG.gyroSync = 0;
                }
            });

            $gyroSync.change();

            $(".requires-v1_4").show();
        } else {
            var looptimeOptions = looptimes[125];
            for (var i in looptimeOptions.looptimes) {
                if (looptimeOptions.looptimes.hasOwnProperty(i)) {
                    $looptime.append('<option value="' + i + '">' + looptimeOptions.looptimes[i] + '</option>');
                }
            }
            $looptime.val(FC_CONFIG.loopTime);
            $looptime.change(function () {
                FC_CONFIG.loopTime = $(this).val();
            });

            $(".requires-v1_4").hide();
        }

        //fill 3D
        if (semver.lt(CONFIG.apiVersion, "1.14.0")) {
            $('.tab-configuration .3d').hide();
        } else {
            $('input[name="3ddeadbandlow"]').val(_3D.deadband3d_low);
            $('input[name="3ddeadbandhigh"]').val(_3D.deadband3d_high);
            $('input[name="3dneutral"]').val(_3D.neutral3d);
            if (semver.lt(CONFIG.apiVersion, "1.17.0")) {
                $('input[name="3ddeadbandthrottle"]').val(_3D.deadband3d_throttle);
            } else {
                $('.3ddeadbandthrottle').hide();
            }
        }

        $('input[type="checkbox"].feature', features_e).change(function () {
            var element = $(this),
                index = element.data('bit'),
                state = element.is(':checked');

            if (state) {
                BF_CONFIG.features = bit_set(BF_CONFIG.features, index);
                if(element.attr('name') === 'MOTOR_STOP')
                    $('div.disarmdelay').show();
            } else {
                BF_CONFIG.features = bit_clear(BF_CONFIG.features, index);
                if(element.attr('name') === 'MOTOR_STOP')
                    $('div.disarmdelay').hide();
            }
        });

        // UI hooks
        $('input[type="radio"].feature', features_e).change(function () {
            var element = $(this),
                group = element.attr('name');

            var controls_e = $('input[name="' + group + '"]');
            var selected_bit = controls_e.filter(':checked').val();

            controls_e.each(function() {
                var bit = $(this).attr('value');

                var selected = (selected_bit == bit);
                if (selected) {
                    BF_CONFIG.features = bit_set(BF_CONFIG.features, bit);
                } else {
                    BF_CONFIG.features = bit_clear(BF_CONFIG.features, bit);
                }

            });
        });


        $('a.save').click(function () {
            // gather data that doesn't have automatic change event bound
            BF_CONFIG.board_align_roll = Math.round(parseFloat($('input[name="board_align_roll"]').val()) * 10);
            BF_CONFIG.board_align_pitch = Math.round(parseFloat($('input[name="board_align_pitch"]').val()) * 10);
            BF_CONFIG.board_align_yaw = Math.round(parseFloat($('input[name="board_align_yaw"]').val()) * 10);

            MISC.mag_declination = parseFloat($('input[name="mag_declination"]').val());

            // motor disarm
            if(semver.gte(CONFIG.apiVersion, "1.8.0")) {
                ARMING_CONFIG.auto_disarm_delay = parseInt($('input[name="autodisarmdelay"]').val());
                ARMING_CONFIG.disarm_kill_switch = ~~$('input[name="disarmkillswitch"]').is(':checked'); // ~~ boolean to decimal conversion
            }

            MISC.minthrottle = parseInt($('input[name="minthrottle"]').val());
            MISC.midrc = parseInt($('input[name="midthrottle"]').val());
            MISC.maxthrottle = parseInt($('input[name="maxthrottle"]').val());
            MISC.mincommand = parseInt($('input[name="mincommand"]').val());

            MISC.vbatmincellvoltage = parseFloat($('input[name="mincellvoltage"]').val());
            MISC.vbatmaxcellvoltage = parseFloat($('input[name="maxcellvoltage"]').val());
            MISC.vbatwarningcellvoltage = parseFloat($('input[name="warningcellvoltage"]').val());
            MISC.vbatscale = parseInt($('input[name="voltagescale"]').val());

            BF_CONFIG.currentscale = parseInt($('input[name="currentscale"]').val());
            BF_CONFIG.currentoffset = parseInt($('input[name="currentoffset"]').val());
            MISC.multiwiicurrentoutput = ~~$('input[name="multiwiicurrentoutput"]').is(':checked'); // ~~ boolean to decimal conversion

            _3D.deadband3d_low = parseInt($('input[name="3ddeadbandlow"]').val());
            _3D.deadband3d_high = parseInt($('input[name="3ddeadbandhigh"]').val());
            _3D.neutral3d = parseInt($('input[name="3dneutral"]').val());
            if (semver.lt(CONFIG.apiVersion, "1.17.0")) {
                _3D.deadband3d_throttle = ($('input[name="3ddeadbandthrottle"]').val());
            }


            SENSOR_ALIGNMENT.align_gyro = parseInt(orientation_gyro_e.val());
            SENSOR_ALIGNMENT.align_acc = parseInt(orientation_acc_e.val());
            SENSOR_ALIGNMENT.align_mag = parseInt(orientation_mag_e.val());

            // track feature usage
            if (FC.isFeatureEnabled('RX_SERIAL', features)) {
                googleAnalytics.sendEvent('Setting', 'SerialRxProvider', serialRXtypes[RX_CONFIG.serialrx_provider]);
            }

            // track feature usage
            if (FC.isFeatureEnabled('RX_NRF24', features)) {
                googleAnalytics.sendEvent('Setting', 'nrf24Protocol', nrf24Protocoltypes[RX_CONFIG.nrf24rx_protocol]);
            }

            if (FC.isFeatureEnabled('GPS', features)) {
                googleAnalytics.sendEvent('Setting', 'GpsProtocol', gpsProtocols[MISC.gps_type]);
                googleAnalytics.sendEvent('Setting', 'GpsSbas', gpsSbas[MISC.gps_ubx_sbas]);
            }

            googleAnalytics.sendEvent('Setting', 'Mixer', mixerList[BF_CONFIG.mixerConfiguration - 1].name);
            googleAnalytics.sendEvent('Setting', 'ReceiverMode', $("input[name='rxMode']:checked").closest('tr').find('label').text());
            googleAnalytics.sendEvent('Setting', 'Looptime', FC_CONFIG.loopTime);

            for (var i = 0; i < features.length; i++) {
                var featureName = features[i].name;
                if (FC.isFeatureEnabled(featureName, features)) {
                    googleAnalytics.sendEvent('Setting', 'Feature', featureName);
                }
            }


            function save_serial_config() {
                if (semver.lt(CONFIG.apiVersion, "1.6.0")) {
                    MSP.send_message(MSP_codes.MSP_SET_CF_SERIAL_CONFIG, MSP.crunch(MSP_codes.MSP_SET_CF_SERIAL_CONFIG), false, save_misc);
                } else {
                    save_misc();
                }
            }

            function save_misc() {
                MSP.send_message(MSP_codes.MSP_SET_MISC, MSP.crunch(MSP_codes.MSP_SET_MISC), false, save_3d);
            }

            function save_3d() {
                var next_callback = save_sensor_alignment;
                if(semver.gte(CONFIG.apiVersion, "1.14.0")) {
                   MSP.send_message(MSP_codes.MSP_SET_3D, MSP.crunch(MSP_codes.MSP_SET_3D), false, next_callback);
                } else {
                   next_callback();
                }
            }

            function save_sensor_alignment() {
                var next_callback = save_acc_trim;
                if(semver.gte(CONFIG.apiVersion, "1.15.0")) {
                   MSP.send_message(MSP_codes.MSP_SET_SENSOR_ALIGNMENT, MSP.crunch(MSP_codes.MSP_SET_SENSOR_ALIGNMENT), false, next_callback);
                } else {
                   next_callback();
                }
            }

            function save_acc_trim() {
                MSP.send_message(MSP_codes.MSP_SET_ACC_TRIM, MSP.crunch(MSP_codes.MSP_SET_ACC_TRIM), false
                                , semver.gte(CONFIG.apiVersion, "1.8.0") ? save_arming_config : save_to_eeprom);
            }

            function save_arming_config() {
                MSP.send_message(MSP_codes.MSP_SET_ARMING_CONFIG, MSP.crunch(MSP_codes.MSP_SET_ARMING_CONFIG), false, save_looptime_config);
            }

            function save_looptime_config() {
                MSP.send_message(MSP_codes.MSP_SET_LOOP_TIME, MSP.crunch(MSP_codes.MSP_SET_LOOP_TIME), false, save_rx_config);
            }

            function save_rx_config() {
                var next_callback = saveAdvancedConfig;
                if(semver.gte(CONFIG.apiVersion, "1.21.0")) {
                   MSP.send_message(MSP_codes.MSP_SET_RX_CONFIG, MSP.crunch(MSP_codes.MSP_SET_RX_CONFIG), false, next_callback);
                } else {
                   next_callback();
                }
            }

            function saveAdvancedConfig() {
                var next_callback = saveINAVPidConfig;
                if(semver.gte(CONFIG.flightControllerVersion, "1.3.0")) {
                   MSP.send_message(MSP_codes.MSP_SET_ADVANCED_CONFIG, MSP.crunch(MSP_codes.MSP_SET_ADVANCED_CONFIG), false, next_callback);
                } else {
                   next_callback();
                }
            }

            function saveINAVPidConfig() {
                var next_callback = save_to_eeprom;
                if(semver.gt(CONFIG.flightControllerVersion, "1.3.0")) {
                   MSP.send_message(MSP_codes.MSP_SET_INAV_PID, MSP.crunch(MSP_codes.MSP_SET_INAV_PID), false, next_callback);
                } else {
                   next_callback();
                }
            }

            function save_to_eeprom() {
                MSP.send_message(MSP_codes.MSP_EEPROM_WRITE, false, false, reboot);
            }

            function reboot() {
                GUI.log(chrome.i18n.getMessage('configurationEepromSaved'));

                GUI.tab_switch_cleanup(function() {
                    MSP.send_message(MSP_codes.MSP_SET_REBOOT, false, false, reinitialize);
                });
            }

            function reinitialize() {
                GUI.log(chrome.i18n.getMessage('deviceRebooting'));

                if (BOARD.find_board_definition(CONFIG.boardIdentifier).vcp) { // VCP-based flight controls may crash old drivers, we catch and reconnect
                    $('a.connect').click();
                    GUI.timeout_add('start_connection',function start_connection() {
                        $('a.connect').click();
                    },2500);
                } else {

                    GUI.timeout_add('waiting_for_bootup', function waiting_for_bootup() {
                        MSP.send_message(MSP_codes.MSP_IDENT, false, false, function () {
                            GUI.log(chrome.i18n.getMessage('deviceReady'));
                            TABS.configuration.initialize(false, $('#content').scrollTop());
                        });
                    },1500); // 1500 ms seems to be just the right amount of delay to prevent data request timeouts
                }
            }

            MSP.send_message(MSP_codes.MSP_SET_BF_CONFIG, MSP.crunch(MSP_codes.MSP_SET_BF_CONFIG), false, save_serial_config);
        });

        // status data pulled via separate timer with static speed
        GUI.interval_add('status_pull', function status_pull() {
            MSP.send_message(MSP_codes.MSP_STATUS);
        }, 250, true);
        GUI.interval_add('config_load_analog', load_analog, 250, true); // 4 fps
        GUI.content_ready(callback);
    }
};

TABS.configuration.cleanup = function (callback) {
    if (callback) callback();
};
