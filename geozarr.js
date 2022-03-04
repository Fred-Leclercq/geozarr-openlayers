let latitudeName = "y";  //Name used to represent the latitude variable in the zarr file.
let longitudeName ="x";  //Name used to represent the longitude variable in the zarr file.
let extent = [];         //Extent of the Zarr file
const scaleFactor = 20;  //factor used for color computation
const slicing = [0];     //Slicing on the zarr array (used for 3D zarr file)
const redBand = "B04";   //Name of the red band (group/path)
const greenBand = "B03"; //Name of the green band (group/path)
const blueBand = "B02";  //Name of the blue band (group/path)
/*
	An async function to read Zarr data and then convert it into an image
*/	
async function loadZarr(zarrUrl, canvas) {
	const bands = ({ '': [redBand, greenBand, blueBand] });
    let xData, yData;
	// asynchronous load 
	arrays = await Promise.all(
	
		// iterate on bands array defined 
		Object.entries(bands).map(async ([w,paths]) => {
		
            // declare the store points to highest group e.g.: $zarrUrl/maja_v2
            const store = new zarr.HTTPStore(zarrUrl);
            
            // open group
            const grp = await zarr.openGroup(store);
            
            // read date and then concatenate them (flat()) into an array
            const arrs = await Promise.all(
                paths.map(async p => {
                    const name = `${p}`;	// ? Name of the band ?		
                    const arr = await grp.getItem(p + "/" + zoomLevel + "/band_data");
                    
                    //Read Longitude & Latitude from zarr file.
                    const lonPath = p +"/"+ zoomLevel + "/"+longitudeName;
                    xData = await readXYData(grp,lonPath);
                    const latPath = p +"/"+ zoomLevel + "/"+latitudeName;
                    yData = await readXYData(grp,latPath);
                    //Build Extent from latitude & longitude variables
                    extent = await buildExtent(yData,xData);
                    return { name, arr };
                })
            );
            return arrs;
	  })
	).then(arr => arr.flat());

	// iterate the array to get all data
	let data = await Promise.all(arrays.map(async d => [d.name, await d.arr.get(slicing)]));

	//convert zarr data into an image	
    drawImage(canvas, data, yData, xData)
			
	// Return the canvas data URL
	return canvas.toDataURL();
}

async function readXYData(zarrGroup, bandPath) {
    var item = await zarrGroup.getItem(bandPath);
	return await item.getRaw(null);
};

/**
 * Detect if coordinates are sorted in increasing or decreasing order.
 * @param {*} coordinates 
 * @returns TRUE if coordinates are sorted in ascending order
 */
function isAscending(coordinates){
    let ascending = true;
	for (let x = 0; x < coordinates.length; x += 1) {		
		if(coordinates.data[0][0] !== coordinates.data[0][x]){
			if(coordinates.data[0][0] >= coordinates.data[0][x]){
				ascending = false;				
			}
			break;
		}
	}
	return ascending;
}

/**
 * Build Extent from latitude & longitude variables
 * @param {*} yData : latitude variable
 * @param {*} xData : longitude variable
 * @returns [minx,miny,maxx,maxy]
 */
async function buildExtent(yData,xData){

	//read minX, minY, maxX, maxY from x and y to compute the extent
	var minx,miny,maxx,maxy;
	// read x data to extract minX and maxX
	if(xData){
		minx = xData.data[0];
		maxx = xData.data[xData.data.length - 1];
	}
			
	// read y data to extract minY and maxY			
	if(yData){
		miny = yData.data[yData.data.length - 1];
		maxy = yData.data[0];
	}
	
	//reverve X(min,max) and Y(min,max) in case of incorrect order
	if(minx > maxx){
		let tmpx = maxx;
		maxx = minx;
		minx = tmpx;
	}
	if(miny > maxy){
		let tmpy = maxy;
		maxy = miny;
		miny = tmpy;
	}
    // Build the extent
	extent = [minx,miny,maxx,maxy];
    return extent;
}
/**
 * Draw Image to canvas using Zarr values
 * @param {*} canvas 
 * @param {*} data 
 * @param {*} yData 
 * @param {*} xData 
 */
function drawImage(canvas, data, yData, xData){
    // get image size (height and width) from shape attribute			
	let height = data[0][1].shape[data[0][1].shape.length -2];
	let width = data[0][1].shape[data[0][1].shape.length -1];
	
	//set width and height of the Zarr image to the canvas size
	canvas.width=width;
	canvas.height=height;  
	
	const ctx = canvas.getContext('2d');
	const imageData = ctx.createImageData(width, height);

    //Fill image from zarr values
    fillImage(imageData,data,yData,xData)

    // Draw image data to the canvas
	ctx.putImageData(imageData, 0, 0);
}
/**
 * Fill canvas image with zarr values
 * @param {*} imageData 
 * @param {*} data 
 * @param {*} yData 
 * @param {*} xData 
 */
function fillImage(imageData,data, yData, xData){

	let offset = 0;	
    let xlen = imageData.width;
    let ylen = imageData.height;
	
    //detect the order of x and y
	let xIncrease = isAscending(xData);
	let yIncrease = isAscending(yData);
	
	for (let x = 0; x < xlen; x += 1) {		
		for (let y = 0; y < ylen; y += 1) {
			let xi = x;
			if(!xIncrease) {
				xi= (xlen -1) -x;
			}
			let yi = y;
			if(!yIncrease) {
				yi = (ylen - 1) - y;
			}			
			
			let red = data[0][1].data[xi][yi]/scaleFactor;
			let green = data[1][1].data[xi][yi]/scaleFactor;
			let blue = data[2][1].data[xi][yi]/scaleFactor;
			
			imageData.data[offset + 0] = red; // R value
			imageData.data[offset + 1] = green; // G value
			imageData.data[offset + 2] = blue; // B value
			imageData.data[offset + 3] = 255;
			/*
			if(green > 0){
				// if the green component value is higher than 250 make the pixel transparent
				imageData.data[offset + 3] = 0;
			}else{
				imageData.data[offset + 3] = 255;
			}			
			*/
			offset +=4;
		}
	}
}

function getZarrExtent(){
    return extent;
}