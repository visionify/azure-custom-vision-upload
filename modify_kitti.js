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
    var filesArray = fs.readdirSync(sampleDataRoot).filter(file => fs.lstatSync(sampleDataRoot + file).isFile())
    for (let file of filesArray) {
        let labelFile = file.split('.')[0] + '.txt'
        if (fs.existsSync(labelFolder + labelFile)) {
            continue
        } else {
            // fs.unlink(trainFolder + file)
            count++
            console.log('delete file :: ', trainFolder + file)
        }
    }
    console.log('Total files deleted :: ', count)
}