const util = require('util');
const fs = require('fs');
const TrainingApi = require("@azure/cognitiveservices-customvision-training");
const PredictionApi = require("@azure/cognitiveservices-customvision-prediction");
const msRest = require("@azure/ms-rest-js");
var xml2json = require('xml2js');
var parser = new xml2json.Parser();
const { promises: { readdir } } = require('fs')
const setTimeoutPromise = util.promisify(setTimeout);

let cs_training_key = "24ddfbfed63f4d97abc89a88c3d0798a"
let cs_training_endpoint = "https://oos-object-detection-beverages.cognitiveservices.azure.com/"
let my_training_key = "843152cfc1eb45e9aeac3308398b9b67"
let my_training_endpoint = "https://mltrainingtest.cognitiveservices.azure.com/"

//CONFIGURATIONS : Update these values
const trainingKey = my_training_key;
const trainingEndpoint = my_training_endpoint;
const predictionKey = "24ddfbfed63f4d97abc89a88c3d0798a"; //
const predictionResourceId = "/subscriptions/14ef0c4c-a76e-442f-bfa9-d986d43b5f25/resourceGroups/ml-training/providers/Microsoft.CognitiveServices/accounts/mltrainingtest-Prediction";
const predictionEndpoint = "https://mltrainingtest-prediction.cognitiveservices.azure.com/"; //
let baseFolder = "/home/abhian/work/testframework/data/shelf_training_B_2/"
const trainingProjectName = 'Shelf Detection'
const publishIterationName = "detectModel";

const credentials = new msRest.ApiKeyCredentials({ inHeader: { "Training-key": trainingKey } });
const trainer = new TrainingApi.TrainingAPIClient(credentials, trainingEndpoint);
const predictor_credentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
const predictor = new PredictionApi.PredictionAPIClient(predictor_credentials, predictionEndpoint);


async function main({ deletePreviousProject }) {
    if (deletePreviousProject) {
        let projects = await trainer.getProjects()
        for (let project of projects) {
            try {
                await trainer.deleteProject(project.id)
            } catch (e) {
                console.error('error while deleting prev projects :: ', e)
            }
        }
    }
    console.log("Creating project...");
    const domains = await trainer.getDomains()
    console.log('________________________________________DOMAIN', domains)
    const objDetectDomain = domains.find(domain => domain.type === "ObjectDetection")
    const sampleProject = await trainer.createProject(trainingProjectName, { domainId: objDetectDomain.id });
    console.log("Sample project ID: " + sampleProject.id);
    const shelvesTag = await trainer.createTag(sampleProject.id, "Shelves");

    let folders = (await readdir(baseFolder, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

    console.log(folders)

    for (let folder of folders) {
        let tempAddress = `/home/abhian/work/testframework/data/shelf_training_B_2/${folder}`
        let subfolders = (await readdir(tempAddress, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
        console.log(subfolders)
        for (let subfolder of subfolders) {
            let sourceFolder = `/home/abhian/work/testframework/data/shelf_training_B_2/${folder}/${subfolder}/output-shelf-images-${folder}-${subfolder}/input-shelf-images-${folder}-${subfolder}/`
            try {
                await uploadAllImageFromAFolderWithOnlyImage(sourceFolder, shelvesTag, sampleProject)
            } catch (e) {
                console.error(e, 'sourceFolder :: ', sourceFolder)
            }
        }
    }


    //Uncomment the following lines if you need to do training and prediction as well
    /*
    console.log("Training...");
    let trainingIteration = await trainer.trainProject(sampleProject.id);

    // Wait for training to complete
    console.log("Training started...");
    while (trainingIteration.status == "Training") {
        try {
            console.log("Training status: " + trainingIteration.status);
            // wait for ten seconds
            await setTimeoutPromise(10000, null);
            trainingIteration = await trainer.getIteration(sampleProject.id, trainingIteration.id)
        } catch (e) {
            await setTimeoutPromise(10000, null);
            console.log(e, 'Error Again')
        }
    }
    console.log("Training status:::::::::::::::::::: " + trainingIteration.status);

    // Publish the iteration to the end point
    await trainer.publishIteration(sampleProject.id, trainingIteration.id, publishIterationName, predictionResourceId);
    // // <snippet_test>
    const testFile = fs.readFileSync(sampleDataRoot + '4155-wba13826000c001-1600200616942-bottom.jpg');
    const results = await predictor.detectImage(sampleProject.id, publishIterationName, testFile)

    // Show results
    console.log("Results:");
    results.predictions.forEach(predictedResult => {
        console.log(`\t ${predictedResult.tagName}: ${(predictedResult.probability * 100.0).toFixed(2)}% ${predictedResult.boundingBox.left},${predictedResult.boundingBox.top},${predictedResult.boundingBox.width},${predictedResult.boundingBox.height}`);
    });

    // console.log("Unpublishing iteration ID: " + trainingIteration.id);
    // await trainer.unpublishIteration(sampleProject.id, trainingIteration.id);
    // console.log("Deleting project ID: " + sampleProject.id);
    // await trainer.deleteProject(sampleProject.id);
    // </snippet_delete>
    // <snippet_function_close>
    */
}


async function uploadAllImageFromAFolderWithOnlyImage(sampleDataRoot, shelvesTag, sampleProject) {
    let filesArray = fs.readdirSync(sampleDataRoot).filter(file => fs.lstatSync(sampleDataRoot + file).isFile())
    filesArray = filesArray.filter(a => a.split('.')[1] === 'jpg')
    let fileUploadPromises = [];
    let entries = []
    for (let file of filesArray) {
        file = file.split('.')[0]
        var contents = fs.readFileSync(sampleDataRoot + file + '.xml', 'utf8');
        let result = await parser.parseStringPromise(contents)
        let size = result.annotation.size[0]
        result = result.annotation.object
        if (!result) {
            console.log('There was some issue with the annotation for :: ', sampleDataRoot + file)
            console.log('continuing to the next image')
            continue
        }

        const img_contents = fs.readFileSync(`${sampleDataRoot}${file}.jpg`);
        const entry = {
            name: file,
            contents: img_contents,
            regions: result.map(i => {
                let region = i.bndbox
                let left = (region[0].xmin)[0] / size.width[0]
                let bot = (region[0].ymax)[0] / size.height[0]
                let right = (region[0].xmax)[0] / size.width[0]
                let top = (region[0].ymin)[0] / size.width[0]
                return {
                    tagId: shelvesTag.id,
                    left: +left,
                    top: +top,
                    width: Math.abs(right - left),
                    height: Math.abs(top - bot),
                }

            })
        }
        entries.push(entry)
    }
    const batch = { images: entries };
    await setTimeoutPromise(1000, null);
    fileUploadPromises.push(trainer.createImagesFromFiles(sampleProject.id, batch));
    let uploadResult = await Promise.all(fileUploadPromises);
    console.log(uploadResult[0])
    console.log('Completed upload of all iamges from :: ', sampleDataRoot)
}


main({ deletePreviousProject: true })
