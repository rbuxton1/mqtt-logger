const mqtt = require('mqtt');
const express = require('express');
const path = require('path');
const fs = require('fs');

const client  = mqtt.connect(process.env.BROKER, {
	clientId: 'logger',
	username: process.env.MQTT_USER,
	password: process.env.MQTT_PSK,
	clean: true,
	connectTimeout: 4000,
	reconnectPeriod: 1000,
});
const app = express();
app.use(express.json());

client.on('connect', () => {
	client.subscribe('#', (err) => {
		if (!err) {
			console.log('Connected to MQTT broker and subscribed!');
		} else {
			console.error('Failed to connect to MQTT broker!');
		}
	});
});

const getTimeDiffAsMinutes = (timeA, timeB) => {
	return Math.floor((Math.abs(new Date(timeA) - new Date(timeB))/1000)/60);
}
const getTimeDiffAsMinutesFloat = (timeA, timeB) => {
	return (Math.abs(new Date(timeA) - new Date(timeB))/1000)/60;
}
const createObject = (value, timestamp) => {
	return {
		val: value,
		time: timestamp
	};
}
const average = (sum, next, index, array) => {
	sum += Number(next.val)
	if (index === array.length - 1) {
		return sum / array.length;
	}
	return sum;
}

let data = {};

client.on('message', (topic, message) => {
	console.log('MQTT:', topic, '> ', message.toString());
	const newTime = new Date().toString();
	let prevData = data;
	//console.log(data[topic]?.last100?.at(0)?.time?.split(' ')?.at(4), data[topic]?.last100?.at(-1)?.time?.split(' ')?.at(4), data[topic]?.last100?.length, data[topic]?.last100Minutes?.at(0)?.time?.split(' ')?.at(4), data[topic]?.last100Minutes?.at(-1)?.time?.split(' ')?.at(4), data[topic]?.last100Minutes?.length);
	
	if (typeof(message) != 'boolean' && !isNaN(message)) {
		data[topic] = {
			last100: 
				data[topic]?.last100 ?
					[
						createObject(message.toString(), newTime),
						...data[topic]?.last100
					].slice(0, 100)
				:
					[
						createObject(message.toString(), newTime)
					],
			last100Minutes:
				// If there exists data for this interval and 
				// the difference between now and the most recent entry is greater than or equal to 1
				data[topic]?.last100Minutes?.length > 0 &&
				getTimeDiffAsMinutes(data[topic]?.last100Minutes?.at(0)?.time, newTime) >= 1?
					// Add the average of the "raw" data between last entry and now  to the beginning of the data 
					[
						createObject(data[topic]?.last100.slice(0, data[topic]?.last100?.findIndex(el => new Date(el.time) > new Date(newTime))).reduce(average, 0), newTime),
						...data[topic]?.last100Minutes
					].slice(0, 100)
				// If instead the data is undefined and 
				// there is enough data in the previous set 
				: data[topic]?.last100Minutes?.length === 0 &&
				  getTimeDiffAsMinutes(data[topic]?.last100?.at(-1)?.time, data[topic]?.last100?.at(0)?.time) >= 1 ?
					// Create average of the initial data set 
					[
						createObject(data[topic]?.last100?.reduce(average, 0), newTime)
					]
				// Else return the previous state
				: data[topic]?.last100Minutes || [],
			last100FifteenMinutes:
				// If there exists data for this interval and 
				// the difference between now and the most recent entry is greater than or equal to 1
				data[topic]?.last100FifteenMinutes?.length > 0 &&
				getTimeDiffAsMinutes(data[topic]?.last100FifteenMinutes?.at(0)?.time, newTime) >= 15?
					// Add the average of the "raw" data between last entry and now  to the beginning of the data 
					[
						createObject(data[topic]?.last100Minutes?.slice(0, data[topic]?.last100Minutes?.findIndex(el => new Date(el.time) > new Date(newTime))).reduce(average, 0), newTime),
						...data[topic]?.last100FifteenMinutes
					].slice(0, 100)
				// If instead the data is undefined and 
				// there is enough data in the previous set 
				: data[topic]?.last100FifteenMinutes?.length === 0 &&
				  getTimeDiffAsMinutes(data[topic]?.last100Minutes?.at(-1)?.time, data[topic]?.last100Minutes?.at(0)?.time) >= 15 ?
					// Create average of the initial data set 
					[
						createObject(data[topic]?.last100Minutes?.reduce(average, 0), newTime)
					]
				// Else return the previous state
				: data[topic]?.last100FifteenMinutes || [],
			last100Hours:
				// If there exists data for this interval and 
				// the difference between now and the most recent entry is greater than or equal to 1
				data[topic]?.last100Hours?.length > 0 &&
				getTimeDiffAsMinutes(data[topic]?.last100Hours?.at(0)?.time, newTime) >= 60?
					// Add the average of the "raw" data between last entry and now  to the beginning of the data 
					[
						createObject(data[topic]?.last100Minutes?.slice(0, data[topic]?.last100Minutes?.findIndex(el => new Date(el.time) > new Date(newTime))).reduce(average, 0), newTime),
						...data[topic]?.last100Hours
					].slice(0, 100)
				// If instead the data is undefined and 
				// there is enough data in the previous set 
				: data[topic]?.last100Hours?.length === 0 &&
				  getTimeDiffAsMinutes(data[topic]?.last100Minutes?.at(-1)?.time, data[topic]?.last100Minutes?.at(0)?.time) >= 60 ?
					// Create average of the initial data set 
					[
						createObject(data[topic]?.last100Minutes?.reduce(average, 0), newTime)
					]
				// Else return the previous state
				: data[topic]?.last100Hours || [],
		};
	} else {
		data[topic] = createObject(message.toString(), newTime);
	}
});

client.on('error', (error) => {
    console.error(error);
});

app.get('/data', (req, res) => {
	res.send(data);
});

app.post('/config', (req, res) => {
    let config = req.body;
    fs.writeFile('./config.json', JSON.stringify(config), 'utf-8', (err, data) => {
        if (err) res.send({success: false, error: err});
        else res.send({...config, success: true});
    });
});

app.get('/graphData', (req, res) => {
	const timeScales = Object.keys(data[Object.keys(data)[0]]);
	let config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
	
	let graphData = timeScales.reduce((ret, currScale) => {
		ret[currScale] = Object.keys(data).reduce((sensorRet, currSensor) => {
			// sensorRet[currSensor] = rawData[currSensor][currScale];
			if (!currSensor.includes('status')) {
				// Handle cases where the data might not match the labels 
				let sensorData = data[currSensor][currScale];	    	
			    
				sensorRet.datasets.push({
					label: currSensor,
					config: config[currSensor] || undefined,
					data: sensorData.sort((a, b) => new Date(a.time) - new Date(b.time)).map(point => { return { x: new Date(point.time), y: point.val } }),
					avg: Math.trunc(data[currSensor][currScale].sort((a, b) => new Date(a.time) - new Date(b.time)).map(point => point.val).reduce((acc, next) => acc + parseFloat(next), 0.0) / data[currSensor][currScale].length * 100) / 100,
					borderWidth: 1
			    	});
			}

			return sensorRet;
		}, {/*labels: [],*/ datasets: []})
		
		return ret;
	}, {});

	res.send(graphData);
});

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '/index.html'));
});

app.listen(3000, () => {
	console.log('Listening to HTTP on port 3000.');
});
