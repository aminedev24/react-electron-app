const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const isDev = require('electron-is-dev');

// Directory paths
const userDataPath = app.getPath('userData');
console.log(userDataPath)
const dataDirectoryPath = path.join(userDataPath, 'myDataDirectory');
const MaterialsDataFilePath = path.join(dataDirectoryPath, 'materialData.json');
const ProductsDataFilePath = path.join(dataDirectoryPath, 'productData.json');
const TransactionsFilePath = path.join(dataDirectoryPath, 'transactionData.json');
const CategoriesDataFilePath = path.join(dataDirectoryPath, 'categoriesData.json');
const formDataHistoryFilePath = path.join(dataDirectoryPath, 'formDataHistory.json');

// Ensure data directory and files exist
const createDataDirectoryAndFiles = (filePath, defaultValue) => {
  if (!fs.existsSync(filePath)) {
    console.log(`${filePath} doesn't exist creating ${filePath}...`)
    fs.writeFileSync(filePath, JSON.stringify(defaultValue));
  }
};

createDataDirectoryAndFiles(formDataHistoryFilePath, []);
createDataDirectoryAndFiles(CategoriesDataFilePath, []);
createDataDirectoryAndFiles(ProductsDataFilePath, []);
createDataDirectoryAndFiles(MaterialsDataFilePath, []);
createDataDirectoryAndFiles(TransactionsFilePath, {});

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
    mainWindow.webContents.openDevTools();
    console.log('Running in dev mode');
  } else {
    mainWindow.loadFile(path.join(__dirname, '/react-app/build', 'index.html')); // Production
  }

 
  mainWindow.webContents.on('beforeunload', (event) => {
    event.preventDefault();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper function to read data from a JSON file
const readDataFromJsonFile = async (filePath) => {
  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    //console.log(`Read data from ${filePath}:`, data);
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return null;
  }
};

const writeDataToJsonFile = async (filePath, data) => {
  try {
    await fs.promises.writeFile(filePath, JSON.stringify(data,null,2));
    console.log(`Data saved to ${filePath}`);
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
};

let isQuantitiesAccumulated = false;

ipcMain.on('updateProductQuantitiesFromHistory', async (event) => {
  try {
    const productData = await readDataFromJsonFile(ProductsDataFilePath);
    const historyData = await readDataFromJsonFile(formDataHistoryFilePath) || [];

    // Update product quantities from history
    productData.forEach((product) => {
      const productHistory = historyData.find((entry) => entry.productName === product.productName);
      if (productHistory && Array.isArray(productHistory.history)) {
        const totalQuantity = productHistory.history.reduce(
          (total, entry) => total + (entry.quantity || 0),
          0
        );
        product.quantity = totalQuantity;
      }
    });

    await writeDataToJsonFile(ProductsDataFilePath, productData);

    //console.log('Product quantities updated from history:', productData);
    event.reply('updateProductQuantitiesFromHistoryResponse', { success: true });
  } catch (error) {
    console.error('Error updating product quantities from history:', error);
    event.reply('updateProductQuantitiesFromHistoryResponse', {
      success: false,
      error: error.message,
    });
  }
});




ipcMain.on('updateProductHistory', async (event, productInfo) => {
  try {
    const { productName, quantitySold, selectedHistoryEntry } = productInfo;
    const isReturnMode = productInfo.returnMode;
    console.log(`Updating product history for:`, productName);
    console.log(`Quantity sold:`, quantitySold);

    const productHistoryFilePath = path.join(formDataHistoryFilePath);
    console.log('Product history file path:', productHistoryFilePath);

    let existingProductHistory = await readDataFromJsonFile(productHistoryFilePath) || [];
    console.log('Existing product history before update:', existingProductHistory);

    const updatedProductHistory = existingProductHistory.map((product) => {
      if (product.productName === productName) {
        return {
          ...product,
          history: product.history.map((entry) => {
            if (entry.submissionTime === selectedHistoryEntry.submissionTime) {
              // Update the quantity in the selected entry
              entry.quantity = isReturnMode ? entry.quantity + quantitySold : entry.quantity - quantitySold;
              console.log(`Updated quantity for ${productName} to:`, entry.quantity);
            }
            return entry;
          }),
        };
      }
      return product;
    });

    await writeDataToJsonFile(productHistoryFilePath, updatedProductHistory);
    console.log('Product history updated successfully.');

    event.reply('updateProductHistoryResponse', { success: true, quantitySold });
  } catch (error) {
    console.error('Error updating product history:', error);
    event.reply('updateProductHistoryResponse', { success: false, error: error.message });
  }
});





ipcMain.on('saveProductHistory', async (event, { productName, historyEntry }) => {
  console.log(`Received saveProductHistory event for ${productName}:`, historyEntry);
  try {
    let historyData = await readDataFromJsonFile(formDataHistoryFilePath) || [];
    console.log(`historyData`, historyData);

    // Find the product entry in historyData or create one
    const productHistory = historyData.find(entry => entry.productName === productName);
    
    if (productHistory) {
      // Product entry found, push the new historyEntry
      productHistory.history.push(historyEntry);
    } else {
      // Product entry not found, create a new entry
      historyData.push({
        productName: productName,
        history: [historyEntry],
      });
    }

    console.log('Updated history data:', historyData);
    await writeDataToJsonFile(formDataHistoryFilePath, historyData);
    event.reply('saveProductHistoryResponse', { success: true });
  } catch (error) {
    console.error(`Failed to save product history for ${productName}:`, error);
    event.reply('saveProductHistoryResponse', { success: false, error: error.message });
  }
});



ipcMain.on('requestProductHistory', async (event, productName) => {
  try {
    //console.log('Fetching product history for:', productName);

    const historyData = await readDataFromJsonFile(formDataHistoryFilePath) || [];
    const productEntry = historyData.find((entry) => entry.productName === productName);
    const productHistory = productEntry ? productEntry.history || [] : [];

    // Log the product history for debugging purposes
    console.log('Product history fetched:', productHistory);

    event.reply('productHistoryResponse', { success: true, data: productHistory });
  } catch (error) {
    console.error('Error fetching product history:', error);

    event.reply('productHistoryResponse', { success: false, error: error.message });
  }
});





// IPC event to save data
// IPC event to save data
ipcMain.on('saveData', async (event, data) => {
  const filePath = path.join(dataDirectoryPath, `${data.type.toLowerCase()}Data.json`);
  try {
    let writeResult = await writeDataToJsonFile(filePath, data);
    //console.log(`Write result for ${data.type} data:`, writeResult);
    event.reply('saveDataResponse', { success: true });
  } catch (error) {
    event.reply('saveDataResponse', { success: false, error: error.message });
  }
});

// IPC event to get data from files
// IPC event to get data from files
ipcMain.on('getDataFromDirectory', async (event) => {
  try {
    //console.log('Data directory exists:', fs.existsSync(dataDirectoryPath));

    const materialsJsonData = await readDataFromJsonFile(MaterialsDataFilePath) || [];
    const productsJsonData = await readDataFromJsonFile(ProductsDataFilePath) || [];
    const transactionsJsonData = await readDataFromJsonFile(TransactionsFilePath) || {};
    const productHistoryJsonData = await readDataFromJsonFile(formDataHistoryFilePath || {})
    //console.log(productHistoryJsonData)
    event.reply('getDataResponse', {
      success: true,
      data: { materialsData: materialsJsonData, productsData: productsJsonData, transactionsData: transactionsJsonData,productHistoryData:productHistoryJsonData  },
    });
  } catch (error) {
    event.reply('getDataResponse', { success: false, error: error.message });
  }
});

// IPC event to delete data
ipcMain.on('deleteData', async (event, data) => {
  const filePath = path.join(dataDirectoryPath, `${data.type.toLowerCase()}Data.json`);
  const historyFilePath = path.join(dataDirectoryPath, 'formDataHistory.json');
  console.log(filePath);

  try {
    // Delete product data
    const existingData = await readDataFromJsonFile(filePath) || [];
    //console.log('Existing data:', existingData);

    const updatedData = existingData.filter(item => item.id !== data.id);
    //console.log('Updated data:', updatedData);

    await writeDataToJsonFile(filePath, updatedData);

    // Delete associated history data
    const historyData = await readDataFromJsonFile(historyFilePath) || {};
    delete historyData[data.productName];
    await writeDataToJsonFile(historyFilePath, historyData);

    event.reply('deleteDataResponse', { success: true });
  } catch (error) {
    console.error('Error deleting data:', error);
    event.reply('deleteDataResponse', { success: false, error: error.message });
  }
});



// IPC event to modify data
ipcMain.on('modify', async (event, modifiedData) => {
  const filePath = path.join(dataDirectoryPath, `${modifiedData.type.toLowerCase()}Data.json`);
  try {
    const existingData = await readDataFromJsonFile(filePath) || [];
    const dataIndex = existingData.findIndex(item => item.id === modifiedData.id);
    if (dataIndex !== -1) {
      existingData[dataIndex] = modifiedData;
      await writeDataToJsonFile(filePath, existingData);
      event.reply(`modify${modifiedData.type}Response`, { success: true });
    } else {
      event.reply(`modify${modifiedData.type}Response`, { success: false, error: `${modifiedData.type} not found` });
    }
  } catch (error) {
    event.reply(`modify${modifiedData.type}Response`, { success: false, error: error.message });
  }
});

// IPC event to update quantities
ipcMain.on('updateQuantities', async (event, payload) => {
  const { data, type } = payload;
  const filePath = path.join(dataDirectoryPath, `${type.toLowerCase()}Data.json`);
  try {
    await writeDataToJsonFile(filePath, data);
    //console.log(`${type} quantities updated and saved successfully.`);
    event.reply(`update${type}QuantitiesResponse`, { success: true });
  } catch (err) {
    console.error(`Error updating ${type} quantities:`, err);
    event.reply(`update${type}QuantitiesResponse`, { success: false, error: `Failed to update ${type} quantities` });
  }
});

// ... (other IPC events)
