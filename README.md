# MQTT Datalogger
This project is to provide a basic HTTP endpoint that I can use in future projects that will contain a datalog of my various MQTT connected sensors at different time intervals. This project provides both that HTTP endpoint and a very basic webpage with graphs to visualize the data.

## Building 

```
docker build -t mqtt-logger .
docker run -d -e BROKER=${Your MQTT Broker address} -e MQTT_USER=${Your MQTT Username} -e MQTT_PSK=${Your MQTT users password} -p ${Desired port}:3000 -v $PWD/index.html:/usr/src/app/index.html --name mqtt-logger mqtt-logget:latest
```
