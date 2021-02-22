function load(file, appendTo, callback) {
	console.log(file);
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function () {
		if (this.readyState == 4) {
			if (this.status == 200) {
				console.log(this);
				appendTo.append(this.responseText);
				callback();
			}
			if (this.status == 404) console.log("error loading \"" + file + "\"");
		}
	}
	xhttp.open("GET", file, true);
	xhttp.send();
}

function askForPort(callback) {
	var xhttp = new XMLHttpRequest();
	//var url = "http://localhost:3000/port";
	var url = 'https://audio-video-conference.herokuapp.com/port';
	xhttp.open("GET", url);
	xhttp.send();

	xhttp.onreadystatechange = function () {
		if (this.readyState == 4) {
			if (this.status == 200) {
				callback(xhttp.response);
			}
			if (this.status == 404) console.log("error loading \"" + file + "\"");
		}
	}
}