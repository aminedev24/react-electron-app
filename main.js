const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const isDev = require('electron-is-dev');


// ... (previous code)
let appData = [];

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000'); // Development
    //mainWindow.loadFile(path.join(__dirname, '/react-app/build', 'index.html'))
    mainWindow.webContents.openDevTools();
    console.log('Running in dev mode');
  } else {
    mainWindow.loadFile(path.join(__dirname, '/react-app/build', 'index.html')); // Production
  }

  

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('initialData', appData);
  });

  mainWindow.webContents.on('beforeunload', (event) => {
    // Add your logic to handle the refresh event here
    event.preventDefault();
  });
  
}

app.whenReady().then(createWindow);


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ... (rest of the code)

// Create a directory within the userData path to store JSON files
const userDataPath = app.getPath('userData');
const dataDirectoryPath = path.join(userDataPath, 'myDataDirectory');

if (!fs.existsSync(dataDirectoryPath)) {
  fs.mkdirSync(dataDirectoryPath);
}

const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialsData.json');
const ProductsDataFilePath = path.join(dataDirectoryPath, 'productsData.json');
const transactionsFilePath = path.join(dataDirectoryPath, 'transactions.json');

// Create productsData.json if it doesn't exist
if (!fs.existsSync(ProductsDataFilePath)) {
  // Create an empty array if the file doesn't exist
  fs.writeFileSync(ProductsDataFilePath, '[]');
}

// Create materialsData.json if it doesn't exist
if (!fs.existsSync(MaterialsDataFilePath)) {
  // Create an empty array if the file doesn't exist
  fs.writeFileSync(MaterialsDataFilePath, '[]');
}


// Create transactions.json if it doesn't exist
if (!fs.existsSync(transactionsFilePath)) {
  // Create an empty array if the file doesn't exist
  fs.writeFileSync(transactionsFilePath, '{}');
}



console.log(userDataPath)
// Function to read data from a JSON file
// Function to read data from a JSON file
async function readDataFromJsonFile(filePath) {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    //console.log(data)
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return null;
  }
}

// Function to write data to a JSON file
async function writeDataToJsonFile(filePath, data) {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data));
    console.log(`Data saved to ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Handle IPC event to save transactions
ipcMain.on('saveTransactions', (event, transactions) => {
  saveTransactionsToFile(transactions);
  //console.log(transactions)
  event.sender.send('transactionsSaved', 'Transactions saved successfully');
});
// ...

ipcMain.on('getDataFromDirectory', async (event) => {

  try {
    const materialsJsonData = await readDataFromJsonFile(MaterialsDataFilePath) || [];
    const productsJsonData = await readDataFromJsonFile(ProductsDataFilePath) || [];
    const transactionsJsonData = await readDataFromJsonFile(transactionsFilePath) || {};

    //console.log(productsJsonData)

    event.reply('getDataResponse', {
      success: true,
      data: {
        materialsData: materialsJsonData,
        productsData: productsJsonData,
        transactionsData: transactionsJsonData
      },
    });
  } catch (error) {
    event.reply('getDataResponse', { success: false, error: error.message });
  }
});


ipcMain.on('saveData', async (event, data) => {
  const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialsData.json');
  const ProductsDataFilePath = path.join(dataDirectoryPath, 'productsData.json');
  const transactionsFilePath = path.join(dataDirectoryPath, 'transactions.json');

  try {
    if (data.type === 'material' || data.type === 'product') {
      // Handle saving materials and products data
      const filePath = data.type === 'material' ? MaterialsDataFilePath : ProductsDataFilePath;
      if (await writeDataToJsonFile(filePath, data)) {
        event.reply('saveDataResponse', { success: true });
      } else {
        event.reply('saveDataResponse', { success: false, error: 'Failed to save data' });
      }
    } else if (data.type === 'transaction') {
      // Handle saving transactions separately
      const existingTransactions = await readDataFromJsonFile(transactionsFilePath) || {};
      const newTransactions = { ...existingTransactions, ...data };

      if (await writeDataToJsonFile(transactionsFilePath, newTransactions)) {
        event.reply('saveDataResponse', { success: true });
      } else {
        event.reply('saveDataResponse', { success: false, error: 'Failed to save data' });
      }
    } else {
      event.reply('saveDataResponse', { success: false, error: 'Unknown data type' });
    }
  } catch (error) {
    event.reply('saveDataResponse', { success: false, error: error.message });
  }
});


// ...

ipcMain.on('deleteData', async (event, data) => {
  try {
    if (data.type === 'material') {
      const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialsData.json');
      const existingMaterialsData = await readDataFromJsonFile(MaterialsDataFilePath) || [];
  
      const updatedMaterialsData = existingMaterialsData.filter((material) => material.id !== data.id);
  
      if (await writeDataToJsonFile(MaterialsDataFilePath, updatedMaterialsData)) {
        event.reply('deleteDataResponse', { success: true });
      } else {
        event.reply('deleteDataResponse', { success: false, error: 'Failed to delete data' });
      }
    } else if (data.type === 'product') {
      const ProductsDataFilePath = path.join(dataDirectoryPath, 'productsData.json');
      const existingProductsData = await readDataFromJsonFile(ProductsDataFilePath) || [];
  
      const updatedProductsData = existingProductsData.filter(
        (product) => product.id !== data.productToDelete.id
      );
  
      if (await writeDataToJsonFile(ProductsDataFilePath, updatedProductsData)) {
        event.reply('deleteDataResponse', { success: true });
      } else {
        event.reply('deleteDataResponse', { success: false, error: 'Failed to delete data' });
      }
    }
  } catch (error) {
    event.reply('deleteDataResponse', { success: false, error: error.message });
  }
});

// ...

ipcMain.on('modify', async (event, modifiedData) => {
  try {
    if (modifiedData.type === 'material') {
      const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialsData.json');
      const existingMaterialsData = await readDataFromJsonFile(MaterialsDataFilePath) || [];
  
      const materialIndex = existingMaterialsData.findIndex((material) => material.id === modifiedData.id);
  
      if (materialIndex !== -1) {
        existingMaterialsData[materialIndex] = modifiedData;
  
        if (await writeDataToJsonFile(MaterialsDataFilePath, existingMaterialsData)) {
          event.reply('modifyMaterialResponse', { success: true });
        } else {
          event.reply('modifyMaterialResponse', { success: false, error: 'Failed to modify data' });
        }
      } else {
        event.reply('modifyMaterialResponse', { success: false, error: 'Material not found' });
      }
    } else if (modifiedData.type === 'product') {
      const ProductsDataFilePath = path.join(dataDirectoryPath, 'productsData.json');
      const existingProductsData = await readDataFromJsonFile(ProductsDataFilePath) || [];
  
      const productIndex = existingProductsData.findIndex((product) => product.id === modifiedData.id);
  
      if (productIndex !== -1) {
        existingProductsData[productIndex] = modifiedData;
  
        if (await writeDataToJsonFile(ProductsDataFilePath, existingProductsData)) {
          event.reply('modifyProductResponse', { success: true });
        } else {
          event.reply('modifyProductResponse', { success: false, error: 'Failed to modify data' });
        }
      } else {
        event.reply('modifyProductResponse', { success: false, error: 'Product not found' });
      }
    }
  } catch (error) {
    event.reply('modifyMaterialResponse', { success: false, error: error.message });
  }
});


// Handle updating material quantities
ipcMain.on('updateMaterialQuantities', (event, updatedMaterialsData) => {
  const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialsData.json');
  console.log(updatedMaterialsData)
  // Update the material data in your data source (e.g., JSON file)
  try {
    fs.writeFileSync(MaterialsDataFilePath, JSON.stringify(updatedMaterialsData));
    console.log('Material quantities updated and saved successfully.');
    event.reply('updateMaterialQuantitiesResponse', { success: true });
  } catch (err) {
    console.error('Error updating material quantities:', err);
    event.reply('updateMaterialQuantitiesResponse', { success: false, error: 'Failed to update material quantities' });
  }
});

ipcMain.on('updateQuantities', (event, payload) => {
  const { data, type } = payload;

  // Handle the update based on the type (e.g., material, transaction, etc.)
  if (type === 'material') {
      const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialsData.json');
      //console.log(payload)
      // Update the material data in your data source (e.g., JSON file)
      try {
        fs.writeFileSync(MaterialsDataFilePath, JSON.stringify(data));
        console.log('Material quantities updated and saved successfully.');
        event.reply('updateMaterialQuantitiesResponse', { success: true });
      } catch (err) {
        console.error('Error updating material quantities:', err);
        event.reply('updateMaterialQuantitiesResponse', { success: false, error: 'Failed to update material quantities' });
      }
  } 
  else if (type === 'transaction') {
    // Handle transaction update
    //console.log(data)
     const ProductsDataFilePath = path.join(dataDirectoryPath, 'productsData.json');
     //console.log(data);
      try {
        fs.writeFileSync(ProductsDataFilePath, JSON.stringify(data));
        console.log('Product quantities updated and saved successfully.');
        event.reply('updateProductsQuantitiesResponse', { success: true });
      } catch (err) {
        console.error('Error updating product quantities:', err);
        event.reply('updateProductQuantitiesResponse', { success: false, error: 'Failed to update product quantities' });
      }
       
}
  // Handle other data types if needed
});


// ...

// ...
