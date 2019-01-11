/**
 * Created by jeffdaze on 2018-08-01.
 *
 * This will be a bulk SSL cert management tool
 * that interfaces with Lemur:
 *
 * http://lemur.readthedocs.io/
 *
 * Needs to have an import and export and read from files
 *
 * example use:
 *
 * Put certs into the DB from /certs_test/ directory:
 *
 * 	 node cryptex.js -d -u jdaze -p certs_test
 *
 *
 * NOTES: add another file into the import (needs to import some plain text into the description file field)
 *
 *
 * Get all the current certs and save them to a backup dir:
 *
 * 	 node cryptex.js -d -u jdaze -g
 *
 */

//base requires...
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
const exec = require('child_process').exec;

//maybe I should make a switch for https vs http?
const https = require('https');
const http = require('http');


//module requires...
const program = require('commander');
const inquirer = require("inquirer");
const colors = require('colors');

//config vars...
let CONFIG = JSON.parse(fs.readFileSync('./config.json'));

//if the config cannot be found bail right away and alert the user...
if(!CONFIG)
{
	console.error(colors.red("CONFIG VALUES CANNOT BE FOUND!"));
	console.error(colors.red("Please ensure there is a 'config.json' file in this dir"));
	console.error(colors.red("and it contains:"));
	console.error(colors.red("    baseURL"));
	console.error(colors.red("    baseAPI"));
	console.error(colors.red("    ownerEMAIL"));

	process.exit(1);
}


//check the config and ensure all the required values are set...
//I could probably clean these up a bit and make one return to make it more DRY...
if(!CONFIG.baseURL)
{
	console.error(colors.red("baseURL CANNOT BE FOUND!"));
	console.error(colors.red("Please ensure there is a 'config.json' file in this dir"));
	console.error(colors.red("and it contains:"));
	console.error(colors.red("    baseURL"));

	process.exit(1);
}

if(!CONFIG.baseAPI)
{
	console.error(colors.red("baseAPI CANNOT BE FOUND!"));
	console.error(colors.red("Please ensure there is a 'config.json' file in this dir"));
	console.error(colors.red("and it contains:"));
	console.error(colors.red("    baseAPI"));

	process.exit(1);
}

if(!CONFIG.ownerEMAIL)
{
	console.error(colors.red("ownerEMAIL CANNOT BE FOUND!"));
	console.error(colors.red("Please ensure there is a 'config.json' file in this dir"));
	console.error(colors.red("and it contains:"));
	console.error(colors.red("    ownerEMAIL"));

	process.exit(1);
}

//use the config values...
const baseURL = CONFIG.baseURL;
const baseAPI = CONFIG.baseAPI;
const ownerEMAIL = CONFIG.ownerEMAIL;

//auth vars...
let sessionID = "";
let password = "";
let certPassword = "";

let versionVal = "0.0.1";

//start program here...

program

	.version(versionVal)
	.option('-d, --debug', 'Run in debug mode')
	.option('-u, --username <value>', 'Username')
	.option('-g, --get', "Get the data for all stored certificates")
	.option('-p, --put <value>', "Put certificates into storage from specified directory path")
	.option('-s, --silent', "Reduce logging output (only shows critical info)");

//custom help items here; examples for usage...
program.on('--help', function(){
	console.log('');
	console.log('Cryptex '+versionVal+' beta (Jeff Daze)');
	console.log('');
	console.log('A tool to bulk transfer SSL Certs for the Lemur certificate repository.');
	console.log('This tool is intended to "put" files into the Lemur repository or "get" files from it for backup');
	console.log('');
	console.log('To "put" files into the Lemur repository supply a directory that contains one or more directories with domain certs eg:');
	console.log('    /upload_certs/');
	console.log('        /somedomain.com/');
	console.log('            somedomain.com.crt');
	console.log('            somedomain.com.key (optional)');
	console.log('            intermediate.crt (optional)');
	console.log('            somedomain.com.notes (optional)');
	console.log('            somedomain.com.data (optional)');
	console.log('');
	console.log('Those certs can be added to Lemur with the following command (username here is "jdaze"):');
	console.log('    cryptex -u jdaze -p upload_certs')
	console.log('');
	console.log('');
	console.log('To "get" files from the Lemur repository use the following command (username here is "jdaze"):');
	console.log('    cryptex -u jdaze -g');
	console.log('');
	console.log('This will produce a uniquely named backup directory similar to:');
	console.log('    /cert_backup_1542138216209/');
	console.log('');
	console.log('A config.json file is required to specify the URL location of the Lemur instance, the API path, and an owner email eg:');
	console.log('{');
	console.log('    "baseURL": "lemur.domain.com",');
	console.log('    "baseAPI": "/api/1",');
	console.log('    "ownerEMAIL": "user@domain.com"');
	console.log('}');
	console.log('');
});


program
	.parse(process.argv);


if(program.debug)
{
	console.log("Running in debug mode");
	//due to self signed cert in dev environment this can be set
	//DO NOT USE IN PRODUCTION!!!
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

	console.warn(colors.yellow("Running with NODE_TLS_REJECT_UNAUTHORIZED set to 0"));
}

if(!program.username)
{
	console.error(colors.red("No username supplied."));
	process.exit(1);
}




//general HTTP request against our API...
function makeRequest(endpoint, method, data, success)
{
	var dataString = JSON.stringify(data);
	var headers = {};

	if (method == 'GET') {
		endpoint += '?' + querystring.stringify(data);

		//set auth header for the rest of our calls...
		headers = {
			'Authorization': `Bearer ${sessionID}`
		}
	}
	else {
		headers = {
			'Content-Type': 'application/json',
			'Content-Length': dataString.length,
			'Authorization': `Bearer ${sessionID}`
		};
	}
	var options = {
		host: baseURL,
		path: endpoint,
		method: method,
		headers: headers
	};


	var req = https.request(options, function(res) {

		res.setEncoding('utf-8');

		var responseString = '';

		res.on('data', function(data) {
			responseString += data;
		});

		res.on('end', function() {
			//console.log(responseString);
			var responseObject = JSON.parse(responseString);
			success(responseObject);
		});

	});


	req.on('error', function(e){
		console.log(colors.red("Request Failed with the following:\n\n\t"+e));
	});


	req.write(dataString);
	req.end();
}





function login()
{
	makeRequest(
		`${baseAPI}/auth/login`,
		'POST',
		{
			username: program.username,
			password: password
		},
		function(data)
		{
			sessionID = data.token;

			if(sessionID)
			{
				console.log(colors.green('Logged in successfully'));

				//only run our main routine after we've logged in...
				main();
			}
			else
			{
				console.log(colors.red("LOGIN FAILED:\n\n\t"+data.message));
			}

		});
}

function infoLog(data)
{
	if(!program.silent)
	{
		console.log(colors.blue(data));
	}
}


function writeFiles(dir, fileData, fileName)
{
	if(fileData)
	{
		fs.writeFileSync(dir+"/"+fileName, fileData, function(err) {
			if(err)
			{
				return console.log(err);
			}

		});

		infoLog("wrote: "+fileName);

	}
	else
	{
		infoLog("No data present for: "+fileName);
	}

}

//may need to use this to get the cert IDs and then process each one individually...
function getCertStats()
{

	//now make a dir for backup...
	let backupDir = "cert_backup_"+(new Date).getTime();

	//backup path...
	if (!fs.existsSync(backupDir))
	{
		fs.mkdirSync(backupDir);
	}
	else
	{
		console.log(colors.red("Failed to make dir:"+backupDir));
	}

	//get the list of certs...
	makeRequest(`${baseAPI}/certificates/stats`, 'GET', { metric: "id"},
		function(data)
		{
			const results = data;
			for(let y =0;y<results.items.labels.length;y++)
			{
				//get the private key...
				makeRequest(`${baseAPI}/certificates/${results.items.labels[y]}/key`, 'GET', {},
					function(data2)
					{
						//get the rest of the cert data and output...
						makeRequest(`${baseAPI}/certificates/`+results.items.labels[y], 'GET', {},
							function(data)
							{

								//get data to output to files...
								//get the domain name...
								let dirName = data.commonName;

								infoLog("\nGenerating files for: "+dirName+"\n");

								let dir = backupDir+"/"+dirName;

								//individual cert path...
								if (!fs.existsSync(dir))
								{
									fs.mkdirSync(dir);
								}
								else
								{
									console.log(colors.red("Failed to make dir:"+dir));
								}


								//now write the files...

								//[commonname.com].crt
								writeFiles(dir, data.body, dirName+".crt");

								//intermediate.crt
								writeFiles(dir, data.chain, "intermediate.crt");

								//[commonname.com].key
								writeFiles(dir, data2.key, dirName+".key");

								//description text if there is any...
								if(data.description)
								{
									writeFiles(dir, data.description, dirName+".data");
								}

							});

					});

			}

		});
}



//prompt for a password...
inquirer.prompt({
	type: "password",
	name: "password",
	message: "Password:",
	mask:"*"

}).then(function(answer){
	//set the password value...
	password = answer.password;

	//run it!
	login();

});



function main(){
	//lets figure out what the user actually wants to do here...
	//can use flags too I guess?
	if(program.get)
	{
		console.log(colors.green("Retrieving certificates..."));
		//getCerts();

		getCertStats();

	}

	if(program.export)
	{
		//get stuff from the export path eg:
		//
		//	https://lemur.carrierzone.com/api/1/certificates/4/export
		console.log(colors.green("Exporting certificate"));
		exportCert();
	}

	if(program.put)
	{
		console.log("preparing to put certificates into remote storage ("+CONFIG.baseURL+")");

		console.log(colors.yellow("Please enter the passphrase for the encrypted certificate keys"));

		//prompt for a password...
		inquirer.prompt({
			type: "password",
			name: "password",
			message: "Certificate key Password:",
			mask:"*"

		}).then(function(answer){
			//set the password value...
			certPassword = answer.password;

			putCerts();

		});


		/**
		 * This will POST /certificates/upload
		 *
		 * request looks like:
		 *
		 * 	POST /certificates/upload HTTP/1.1
		 *	Host: example.com
		 *	Accept: application/json, text/javascript
		 *
		 *	 {
		 *		"owner": "joe@example.com",
		 *		"body": "-----BEGIN CERTIFICATE-----...",
		 *		"chain": "-----BEGIN CERTIFICATE-----...",
		 *		"privateKey": "-----BEGIN RSA PRIVATE KEY-----..."
		 *		"destinations": [],
		 *		"notifications": [],
		 *		"replacements": [],
		 *		"roles": [],
		 *		"notify": true,
		 *		"name": "cert1"
		 *	 }
		 *
		 *	read in from the supplied dir all the files and send them up to the remote server...
		 */

		function putCerts()
		{
			//get the list of dirs and read the files...
			let path = program.put;

			//get all the directories...
			fs.readdir(path, function(err, items)
			{

				if(typeof items === "undefined")
				{
					console.error(colors.red(path+" does not exist; please supply a directory that contains certificate files"));
					process.exit(1);
				}

				for (let i=0; i<items.length; i++)
				{

					fs.stat(path+"/"+items[i], function(err, stats)
					{
						if(stats.isDirectory())
						{
							console.log("found Dir:", items[i]);

							//now build the post for this cert...
							let certPOST = {};

							//set default properties...
							certPOST.destinations =  [];
							certPOST.notifications = [];
							certPOST.replacements = [];
							certPOST.roles = [];
							certPOST.notify =  true;
							certPOST.description = "";


							certPOST.name = items[i];
							certPOST.owner = ownerEMAIL;

							//basepath per dir...
							let basepath = path + "/" + items[i] + "/";

							//build the path for the crt file...
							let crtpath = basepath + items[i] + ".crt";

							if(fs.existsSync(crtpath))
							{
								certPOST.body = fs.readFileSync(crtpath, 'utf8');
							}

							//build the path for the description files...
							let descriptionFile1 = basepath + items[i] + ".notes";
							let descriptionFile2 = basepath + items[i] + ".data";

							let descriptionData = "";

							//test if the files exist...
							if(fs.existsSync(descriptionFile1))
							{
								descriptionData += "Notes: \n\n" + fs.readFileSync(descriptionFile1, 'utf8') + "\n\n";
							}

							if(fs.existsSync(descriptionFile2))
							{
								descriptionData += "Data: \n\n" + fs.readFileSync(descriptionFile2, 'utf8');
							}

							certPOST.description = descriptionData;

							//build the path for the key file eg:
							//let keypath = basepath + items[i] + ".key";
							//certPOST.privateKey = fs.readFileSync(keypath, 'utf8');

							//build path for chain...
							let chainpath = basepath + "intermediate.crt";

							if(fs.existsSync(chainpath))
							{
								certPOST.chain = fs.readFileSync(chainpath, 'utf8');
							}


							//get the key value unencrypted...

							//build the path for the key file...
							let keypath = basepath + items[i] + ".key";


							if(fs.existsSync(keypath))
							{
								//extract the data...
								let child = exec('openssl rsa -in '+keypath+' -text -passin stdin', function(err, result) {
									if (err) return console.log(err);

									//get the result and parse out just the part we need...
									let rsaHeader = "-----BEGIN RSA PRIVATE KEY-----";
									let rsaParts = result.split(rsaHeader);

									//add the private key to the data to send...
									certPOST.privateKey = rsaHeader+rsaParts[1];

									//now post to the endpoint...
									makeRequest(`${baseAPI}/certificates/upload`, 'POST', certPOST,
										function(data)
										{
											const results = data;

											if(results.message)
											{
												console.log(colors.red("Error posting certificate:", results));
											}

											console.log(colors.green('certificates POSTED:', results));

										}
									);

								});

								//send password to the openssl prompt...
								child.stdin.write(certPassword+"\n");
								child.stdin.end();
							}
							else
							{
								//now post to the endpoint...
								makeRequest(`${baseAPI}/certificates/upload`, 'POST', certPOST,
									function(data)
									{
										const results = data;

										if(results.message)
										{
											console.log(colors.red("Error posting certificate:", results));
										}

										console.log(colors.green('certificates POSTED:', results));

									}
								);
							}

						}

					});

				}
			});

		}


	}

}


//some additional references:
/**
 * https://www.smashingmagazine.com/2017/03/interactive-command-line-application-node-js/
 * https://itnext.io/making-cli-app-with-ease-using-commander-js-and-inquirer-js-f3bbd52977ac
 *
 * https://github.com/tj/commander.js
 */

