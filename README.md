# Grohe Blue Home nodes for node-red

This package contains nodes for controlling Grohe Blue Home devices via the following API:
https://idp2-apigw.cloud.grohe.com


# Dependencies
This package depends on the following libraries
- superagent
- he
- url


# Disclaimer
This package is not developed nor officially supported by the company Grohe.
It is for demonstrating how to communicate to the devices using node-red.
Use on your own risk!

The code was ported from C# and Java and TypeScript which can be found here:
* https://github.com/J0EK3R/Grohe.Ondus.Api
* https://github.com/FlorianSW/grohe-ondus-api-java
* https://github.com/faune/homebridge-grohe-sense

The original code is from:
* https://github.com/windkh/node-red-contrib-grohe-sense

# Credits
- windkh from whom the code is forked and simplified to support only Grohe Blue Home.

# Grohe Blue Node
The node is able to get the status of a Grohe Blue Home device.

To get the status simply send any msg.payload to the input. 

To send a command, add a function node before the Groe Blue Node with the following payload:

```
msg.payload = {  
    command : {
        co2_status_reset: false, 
        tap_type: 0, // 1 = still water , 2 = medium water, 3 = carbonated water
        cleaning_mode: false,
        filter_status_reset: false,
        get_current_measurement: true
        tap_amount: 0, // milliliters
        factory_reset: false,
        revoke_flush_confirmation: false,
        exec_auto_flush: false
    }
};

return msg;
```
Be aware that the measurement retrieved are not the latest ones and you have to send a command for this:

```
msg.payload = {  
    command : {
        get_current_measurement: true
    }
};

return msg;
```
In this case, the node try to wait until the timestamp for the latest measurement is older than the timestamp of the command issued.

# License

Author: Karl-Heinz Wind

The MIT License (MIT)
Copyright (c) 2022 by Karl-Heinz Wind

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
