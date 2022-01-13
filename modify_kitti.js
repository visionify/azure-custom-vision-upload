
let dataset = [
    '2569-wba04233000c017-1576842653644-bottom',
    '2569-wba04233000c017-1576842653644-bottom',
    '2569-wba04233000c017-1576842653644-bottom',
    '2570-wba04233000c017-1576842653644-top',
    '2571-wba04233000c017-1576842653644-middle',
    '2572-wba04233000c017-1576842600114-bottom',
    '2572-wba04233000c017-1576842600114-bottom',
    '2573-wba04233000c017-1576842600114-top',
    '2573-wba04233000c017-1576842600114-top',
    '2574-wba04233000c017-1576842600114-middle',
    '2574-wba04233000c017-1576842600114-middle',
    '2574-wba04233000c017-1576842600114-middle',
    '2575-wba04233000c017-1576842592541-bottom',
    '2575-wba04233000c017-1576842592541-bottom',
    '2576-wba04233000c017-1576842592541-top',
    '2576-wba04233000c017-1576842592541-top',
    '2578-wba04233000c017-1576842761280-bottom',
    '2578-wba04233000c017-1576842761280-bottom',
    '2580-wba04233000c017-1576842761280-middle',
    '2580-wba04233000c017-1576842761280-middle',
    '2581-wba04233000c017-1576842755827-bottom',
    '2581-wba04233000c017-1576842755827-bottom',
    '2583-wba04233000c017-1576842755827-middle',
    '2583-wba04233000c017-1576842755827-middle',
    '2584-wba04233000c017-1576842765996-bottom',
    '2584-wba04233000c017-1576842765996-bottom',
    '2586-wba04233000c017-1576842765996-middle',
    '2586-wba04233000c017-1576842765996-middle',
    '2589-wba04233000c017-1576842637870-middle',
    '2589-wba04233000c017-1576842637870-middle',
    '2590-wba04233000c017-1576842623240-bottom',
    '2590-wba04233000c017-1576842623240-bottom',
    '2591-wba04233000c017-1576842623240-top',
    '2593-wba04233000c017-1576842745312-bottom',
    '2593-wba04233000c017-1576842745312-bottom',
    '2594-wba04233000c017-1576842745312-top',
    '2595-wba04233000c017-1576842745312-middle',
    '2596-wba04233000c017-1576842628570-bottom',
    '2596-wba04233000c017-1576842628570-bottom',
    '2597-wba04233000c017-1576842628570-top',
    '2598-wba04233000c017-1576842628570-middle',
    '2601-wba04233000c017-1576842770529-middle',
]

const fs = require('fs')

async function correctKittiFormat() {
    let sampleDataRoot = '/home/abhian/Documents/samplekitti/'
    var filesArray = fs.readdirSync(sampleDataRoot).filter(file => fs.lstatSync(sampleDataRoot + file).isFile())
    for (let file of filesArray) {
        await processFile(sampleDataRoot + file)
    }
}

async function processFile(file) {
    var contents = fs.readFileSync(file, 'utf8');
    contents = contents
        .split('\n')
        .map(row => row.split(' ').slice(0, -1).join(' '))
        .join('\n')
    fs.writeFileSync(file, contents)
}


// correctKittiFormat()


async function syncLabelAndTrainData() {
    let count = 0
    let trainFolder = '/data/tao_samples/tao-dataset/train/'
    let labelFolder = '/data/tao_samples/tao-dataset/label/'
    var filesArray = fs.readdirSync(trainFolder).filter(file => fs.lstatSync(trainFolder + file).isFile())
    for (let file of filesArray) {
        let labelFile = file.split('.')[0] + ''
        if (fs.existsSync(labelFolder + labelFile)) {
            continue
        } else {
            // fs.unlink(trainFolder + file,()=>{})
            count++
            console.log('delete file :: ', trainFolder + file)
        }
    }
    console.log('Total files deleted :: ', count)
}


async function deleteLabelAndTrainData() {
    let trainFolder = '/data/tao_samples/tao-dataset/train/'
    let labelFolder = '/data/tao_samples/tao-dataset/label/'
    // '/data/tao_samples/tao-dataset/label/2569-wba04233000c017-1576842653644-bottom'
    for (let file of dataset) {
        fs.unlink(labelFolder + file + '.txt', () => { })
        fs.unlink(trainFolder + file + '.jpg', () => { })
    }
}

deleteLabelAndTrainData()


