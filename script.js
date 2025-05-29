// --- Configuration ---
// Default configuration that will be used if no data in localStorage
const DEFAULT_CONFIG = {
    vnetCidr: "10.0.0.0/8",
    subnets: [
        { name: "default", cidr: "10.0.0.1/24" },
    ]
};

// Define missing constants
const SUBNET_COLORS = [
    '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#27ae60', '#c0392b',
    '#2980b9', '#8e44ad', '#16a085', '#d35400', '#7f8c8d'
];
const GAP_COLOR = '#ecf0f1';

// Load stored data or use defaults
let config = JSON.parse(localStorage.getItem('vnetConfig')) || JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Ensure deep copy for initial load too

// Function to validate CIDR format
function isValidCidr(cidr) {
    const cidrRegex = new RegExp(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/);
    if (!cidrRegex.test(cidr)) return false;

    const [ip, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix);
    if (prefixNum < 0 || prefixNum > 32) return false;

    const octets = ip.split('.');
    return octets.every(octet => {
        const num = parseInt(octet);
        return num >= 0 && num <= 255;
    });
}

// Function to save config to localStorage
function saveConfig() {
    localStorage.setItem('vnetConfig', JSON.stringify(config));
}

// Function to update the visualization
function updateVisualization() {
    // Clear any existing content
    document.getElementById('vnetInfo').innerHTML = '';
    document.getElementById('ipBlocksWrapper').innerHTML = '';
    document.getElementById('legend').innerHTML = '';
    document.getElementById('subnetTableBody').innerHTML = '';
    document.getElementById('errorMessage').innerHTML = '';

    let errorMessages = [];

    // Update VNet CIDR input
    document.getElementById('vnetCidrInput').value = config.vnetCidr;

    try {
        if (!isValidCidr(config.vnetCidr)) {
            errorMessages.push(`Error: Invalid VNet CIDR format: ${config.vnetCidr}`);
            document.getElementById('errorMessage').innerHTML = errorMessages.join('<br>');
            // Attempt to render table with add button even if VNet CIDR is bad
            renderSubnetTable([], null, errorMessages);
            return;
        }

        const vnet = { ...cidrToRange(config.vnetCidr), name: "VNet" };
        VNET_INFO_GLOBAL = vnet;
        document.getElementById('vnetInfo').innerHTML = `
            <p><strong>VNet CIDR:</strong> ${vnet.cidr}</p>
            <p><strong>IP Range:</strong> ${vnet.networkAddress} - ${vnet.broadcastAddress}</p>
            <p><strong>Total IPs:</strong> ${vnet.numAddresses.toLocaleString()}</p>
        `;

        const processedSubnets = config.subnets.map((subnetData, index) => {
            try {
                if (!isValidCidr(subnetData.cidr)) {
                    errorMessages.push(`Error: Subnet ${subnetData.name} has invalid CIDR format: ${subnetData.cidr}.`);
                    return null;
                }
                const range = cidrToRange(subnetData.cidr);
                if (range.startIpLong < vnet.startIpLong || range.endIpLong > vnet.endIpLong) {
                    errorMessages.push(`Error: Subnet ${subnetData.name} (${subnetData.cidr}) is outside the VNet range.`);
                    return null;
                }
                return {
                    ...subnetData,
                    ...range,
                    color: SUBNET_COLORS[index % SUBNET_COLORS.length]
                };
            } catch (e) {
                errorMessages.push(`Error processing subnet ${subnetData.name} (${subnetData.cidr}): ${e.message}`);
                return null;
            }
        }).filter(s => s !== null);

        processedSubnets.sort((a, b) => a.startIpLong - b.startIpLong);

        for (let i = 0; i < processedSubnets.length - 1; i++) {
            if (processedSubnets[i].endIpLong >= processedSubnets[i + 1].startIpLong) {
                errorMessages.push(`Error: Subnet ${processedSubnets[i].name} (${processedSubnets[i].cidr}) overlaps with ${processedSubnets[i + 1].name} (${processedSubnets[i + 1].cidr}).`);
            }
        }

        if (errorMessages.length > 0) {
            document.getElementById('errorMessage').innerHTML = errorMessages.join('<br>');
        }

        const displayBlocks = [];
        let currentIpLongVal = vnet.startIpLong;

        processedSubnets.forEach(subnet => {
            if (subnet.startIpLong > currentIpLongVal) {
                displayBlocks.push({
                    name: "Unallocated", type: "gap", startIpLong: currentIpLongVal,
                    endIpLong: subnet.startIpLong - 1, numAddresses: (subnet.startIpLong - currentIpLongVal),
                    color: GAP_COLOR, cidr: `${longToIp(currentIpLongVal)} - ${longToIp(subnet.startIpLong - 1)}`
                });
            }
            displayBlocks.push({ ...subnet, type: "subnet" });
            currentIpLongVal = subnet.endIpLong + 1;
        });

        if (currentIpLongVal <= vnet.endIpLong) {
            displayBlocks.push({
                name: "Unallocated", type: "gap", startIpLong: currentIpLongVal,
                endIpLong: vnet.endIpLong, numAddresses: (vnet.endIpLong - currentIpLongVal + 1),
                color: GAP_COLOR, cidr: `${longToIp(currentIpLongVal)} - ${longToIp(vnet.endIpLong)}`
            });
        }

        const ipBlocksWrapper = document.getElementById('ipBlocksWrapper');
        ipBlocksWrapper.innerHTML = '';
        displayBlocks.forEach(block => {
            if (block.numAddresses <= 0) return;

            const blockDiv = document.createElement('div');
            blockDiv.classList.add('ip-block');
            blockDiv.style.backgroundColor = block.color;
            const widthPercentage = (block.numAddresses / vnet.numAddresses) * 100;
            blockDiv.style.width = `${widthPercentage}%`;

            block.widthPercentage = widthPercentage;
            blockDiv.ipBlockData = block;

            blockDiv.addEventListener('mousemove', (e) => {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.opacity = '1';
                tooltip.style.left = `${e.pageX}px`;
                tooltip.style.top = `${e.pageY}px`;
                let ipRangeStr = block.type === 'gap' ? `${longToIp(block.startIpLong)} - ${longToIp(block.endIpLong)}` : block.cidr;
                tooltip.innerHTML = `
                    <strong>${block.name}</strong><br>
                    ${block.type === 'subnet' ? `CIDR: ${block.cidr}<br>` : ''}
                    Range: ${ipRangeStr}<br>
                    IPs: ${block.numAddresses.toLocaleString()} (${block.widthPercentage.toFixed(4)}%)
                `;
            });
            blockDiv.addEventListener('mouseleave', () => {
                document.getElementById('tooltip').style.opacity = '0';
            });

            ipBlocksWrapper.appendChild(blockDiv);
        });

        const legendDiv = document.getElementById('legend');
        legendDiv.innerHTML = '';
        const legendItems = {};
        processedSubnets.forEach(subnet => { if (!legendItems[subnet.name]) legendItems[subnet.name] = subnet.color; });
        if (displayBlocks.some(b => b.type === 'gap' && b.numAddresses > 0)) legendItems["Unallocated"] = GAP_COLOR;
        for (const name in legendItems) {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('legend-item');
            itemDiv.innerHTML = `<span class="legend-color-box" style="background-color: ${legendItems[name]};"></span> ${name}`;
            legendDiv.appendChild(itemDiv);
        }

        renderSubnetTable(processedSubnets, vnet, errorMessages);
        // updateBlockTextVisibility(); // Commented out to prevent "not defined" error

    } catch (e) {
        console.error("Error initializing visualizer:", e);
        errorMessages.push(`Fatal Error: ${e.message}. Check console for details.`);
        document.getElementById('errorMessage').innerHTML = errorMessages.join('<br>');
        // Attempt to render table with add button even if VNet CIDR is bad or other fatal error
        renderSubnetTable([], null, errorMessages);
    }
}

function renderSubnetTable(processedSubnets, vnet, errorMessages) {
    const subnetTableBody = document.getElementById('subnetTableBody');
    subnetTableBody.innerHTML = ''; // Clear before populating

    processedSubnets.forEach(subnet => {
        const row = subnetTableBody.insertRow();
        row.insertCell().textContent = subnet.name;
        row.insertCell().textContent = subnet.cidr;
        row.insertCell().textContent = vnet ? `${subnet.networkAddress} - ${subnet.broadcastAddress}` : '-';
        row.insertCell().textContent = vnet ? subnet.numAddresses.toLocaleString() : '-';
        row.insertCell().textContent = vnet ? `${((subnet.numAddresses / vnet.numAddresses) * 100).toFixed(2)}%` : '-';

        const actionsCell = row.insertCell();
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️';
        deleteButton.title = 'Delete subnet';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.border = 'none';
        deleteButton.style.background = 'transparent';
        deleteButton.style.fontSize = '1.2em';
        deleteButton.addEventListener('click', () => {
            const configIndex = config.subnets.findIndex(s => s.name === subnet.name && s.cidr === subnet.cidr);
            if (configIndex !== -1) {
                if (confirm(`Are you sure you want to delete subnet "${subnet.name}" (${subnet.cidr})?`)) {
                    config.subnets.splice(configIndex, 1);
                    saveConfig();
                    updateVisualization();
                }
            } else {
                console.error('Could not find subnet in config to delete:', subnet);
                alert('Error: Could not find subnet to delete.');
            }
        });
        actionsCell.appendChild(deleteButton);
    });

    const addSubnetRow = subnetTableBody.insertRow();
    const addSubnetCell = addSubnetRow.insertCell();
    addSubnetCell.colSpan = 6;
    addSubnetCell.style.textAlign = 'center';

    const createAddButton = () => {
        addSubnetCell.innerHTML = '';
        const addButton = document.createElement('button');
        addButton.textContent = '+ Add Subnet';
        addButton.style.width = '100%';
        addButton.style.padding = '8px';
        addButton.style.backgroundColor = '#2ecc71';
        addButton.style.color = 'white';
        addButton.style.border = 'none';
        addButton.style.borderRadius = '3px';
        addButton.style.cursor = 'pointer';
        addButton.addEventListener('click', () => {
            showInputFieldsInRow(addSubnetCell, createAddButton);
        });
        addSubnetCell.appendChild(addButton);
    };

    const showInputFieldsInRow = (cell, onCancelCallback) => {
        cell.innerHTML = '';
        cell.style.textAlign = 'left';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Subnet Name';
        nameInput.style.padding = '5px';
        nameInput.style.borderRadius = '3px';
        nameInput.style.border = '1px solid #ccc';
        nameInput.style.marginRight = '10px';
        nameInput.style.minWidth = '150px';

        const cidrInput = document.createElement('input');
        cidrInput.type = 'text';
        cidrInput.placeholder = 'Subnet CIDR';
        cidrInput.style.padding = '5px';
        cidrInput.style.borderRadius = '3px';
        cidrInput.style.border = '1px solid #ccc';
        cidrInput.style.marginRight = '10px';
        cidrInput.style.minWidth = '150px';

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.padding = '5px 10px';
        saveButton.style.backgroundColor = '#3498db';
        saveButton.style.color = 'white';
        saveButton.style.border = 'none';
        saveButton.style.borderRadius = '3px';
        saveButton.style.cursor = 'pointer';
        saveButton.style.marginRight = '5px';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.padding = '5px 10px';
        cancelButton.style.backgroundColor = '#e74c3c';
        cancelButton.style.color = 'white';
        cancelButton.style.border = 'none';
        cancelButton.style.borderRadius = '3px';
        cancelButton.style.cursor = 'pointer';

        saveButton.addEventListener('click', () => {
            const newName = nameInput.value.trim();
            const newCidr = cidrInput.value.trim();
            let currentErrors = [];

            if (!newName || !newCidr) {
                currentErrors.push('Name and CIDR are required.');
            }
            if (newCidr && !isValidCidr(newCidr)) {
                currentErrors.push('Invalid CIDR format for new subnet.');
            }
            if (newName && config.subnets.some(s => s.name === newName)) {
                currentErrors.push(`Subnet with name "${newName}" already exists.`);
            }
            if (newCidr && config.subnets.some(s => s.cidr === newCidr)) {
                currentErrors.push(`Subnet with CIDR "${newCidr}" already exists.`);
            }
            
            // Check if new subnet is within VNet (if VNet is valid)
            if (VNET_INFO_GLOBAL && newCidr && isValidCidr(newCidr)) {
                try {
                    const newSubnetRange = cidrToRange(newCidr);
                    if (newSubnetRange.startIpLong < VNET_INFO_GLOBAL.startIpLong || newSubnetRange.endIpLong > VNET_INFO_GLOBAL.endIpLong) {
                        currentErrors.push(`New subnet ${newName} (${newCidr}) is outside the VNet range.`);
                    }
                } catch (e) {
                    // isValidCidr should catch this, but as a fallback
                    currentErrors.push(`Error validating new subnet CIDR: ${e.message}`);
                }
            }


            if (currentErrors.length > 0) {
                alert(currentErrors.join('\\n'));
                return;
            }

            config.subnets.push({ name: newName, cidr: newCidr });
            saveConfig();
            updateVisualization();
        });

        cancelButton.addEventListener('click', () => {
            onCancelCallback();
        });

        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.alignItems = 'center';
        inputContainer.style.justifyContent = 'space-between';
        inputContainer.style.width = '100%';

        const inputsDiv = document.createElement('div');
        inputsDiv.appendChild(nameInput);
        inputsDiv.appendChild(cidrInput);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.appendChild(saveButton);
        buttonsDiv.appendChild(cancelButton);

        inputContainer.appendChild(inputsDiv);
        inputContainer.appendChild(buttonsDiv);

        cell.appendChild(inputContainer);
        nameInput.focus();
    };

    createAddButton();
}


// --- Global VNet object ---
let VNET_INFO_GLOBAL = null;

// --- Helper Functions ---
function ipToLong(ip) {
    return ip.split('.').reduce((acc, octet, index, arr) => {
        return acc + (parseInt(octet) * Math.pow(256, (arr.length - 1 - index)));
    }, 0);
}

function longToIp(long) {
    return [
        (long >>> 24) & 0xFF,
        (long >>> 16) & 0xFF,
        (long >>> 8) & 0xFF,
        long & 0xFF
    ].join('.');
}

function cidrToRange(cidr) {
    const [ip, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
        throw new Error(`Invalid CIDR prefix: ${cidr}`);
    }
    const ipLong = ipToLong(ip);
    const mask = (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF;
    const networkAddressLong = ipLong & mask;
    const broadcastAddressLong = networkAddressLong | (~mask & 0xFFFFFFFF);
    const numAddresses = Math.pow(2, 32 - prefix);

    if ((networkAddressLong >>> 0) !== ipLong >>> 0 && prefix < 31) { // Allow /31 and /32 to have network address same as IP
        // This check might be too strict for some use cases, but generally good for typical subnetting.
        // For /31, networkAddressLong can be ipLong. For /32, it's always ipLong.
        // The issue is if ipLong is not the "network address" for prefixes < 31.
        // Example: 10.0.0.1/24 - ipLong is 10.0.0.1, networkAddressLong is 10.0.0.0. They are different.
        // Example: 10.0.0.0/24 - ipLong is 10.0.0.0, networkAddressLong is 10.0.0.0. They are same. (This is fine)
        // throw new Error(`IP address ${ip} is not the network address for CIDR ${cidr}. Expected network address: ${longToIp(networkAddressLong)}`);
    }

    return {
        cidr: cidr,
        networkAddress: longToIp(networkAddressLong >>> 0),
        broadcastAddress: longToIp(broadcastAddressLong >>> 0),
        startIpLong: networkAddressLong >>> 0, // Usable start for visualization might differ based on convention
        endIpLong: broadcastAddressLong >>> 0,   // Usable end for visualization might differ
        numAddresses: numAddresses
    };
}

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI bindings
    const vnetCidrInput = document.getElementById('vnetCidrInput');
    const updateVnetButton = document.getElementById('updateVnetButton');
    const resetDataButton = document.getElementById('resetDataButton');
    const visualizationArea = document.getElementById('visualizationArea');
    const ipBlocksWrapper = document.getElementById('ipBlocksWrapper');
    const tooltip = document.getElementById('tooltip');


    // Initialize values
    vnetCidrInput.value = config.vnetCidr;

    // Add event listeners for the configuration controls
    updateVnetButton.addEventListener('click', () => {
        const newCidr = vnetCidrInput.value;
        if (!isValidCidr(newCidr)) {
            alert('Invalid CIDR format for VNet.');
            return;
        }
        config.vnetCidr = newCidr;
        saveConfig();
        updateVisualization();
    });

    resetDataButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset to default configuration?')) {
            localStorage.removeItem('vnetConfig');
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); // Deep copy
            updateVisualization();
        }
    });

    let currentZoom = 1.0;
    let currentPanX = 0;
    const MIN_ZOOM = 0.01; // Allow more zoom out
    const MAX_ZOOM = 200.0;  // Allow more zoom in
    const ZOOM_SENSITIVITY = 0.1;

    let isDragging = false;
    let dragStartX = 0;
    let initialPanX = 0;

    visualizationArea.addEventListener('wheel', (event) => {
        event.preventDefault();

        const rect = visualizationArea.getBoundingClientRect();
        const mouseXInArea = event.clientX - rect.left; // Mouse X relative to the visualization area

        const oldZoom = currentZoom;
        if (event.deltaY < 0) {
            currentZoom *= (1 + ZOOM_SENSITIVITY);
        } else {
            currentZoom /= (1 + ZOOM_SENSITIVITY);
        }
        currentZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom));

        // Calculate the point in the content that was under the mouse
        const mouseXInContent = (mouseXInArea - currentPanX) / oldZoom;
        
        // Adjust pan so that the point under the mouse stays the same
        currentPanX = mouseXInArea - (mouseXInContent * currentZoom);
        
        // Clamp panning
        const maxPan = 0; // Cannot pan content to the right of the container's left edge
        const minPan = visualizationArea.clientWidth - (ipBlocksWrapper.scrollWidth * currentZoom); // Max left pan
        currentPanX = Math.max(minPan, Math.min(maxPan, currentPanX));


        ipBlocksWrapper.style.transform = `translateX(${currentPanX}px) scaleX(${currentZoom})`;
        // updateBlockTextVisibility();
    }, { passive: false });


    visualizationArea.addEventListener('mousedown', (event) => {
        isDragging = true;
        dragStartX = event.clientX;
        initialPanX = currentPanX;
        visualizationArea.classList.add('dragging');
    });

    document.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        const dx = event.clientX - dragStartX;
        currentPanX = initialPanX + dx;

        // Clamp panning
        const maxPan = 0;
        const minPan = visualizationArea.clientWidth - (ipBlocksWrapper.scrollWidth * currentZoom);
        currentPanX = Math.max(minPan, Math.min(maxPan, currentPanX));

        ipBlocksWrapper.style.transform = `translateX(${currentPanX}px) scaleX(${currentZoom})`;
        // updateBlockTextVisibility();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            visualizationArea.classList.remove('dragging');
        }
    });
    
    function updateBlockTextVisibility() {
        const blocks = ipBlocksWrapper.querySelectorAll('.ip-block');
        const vnetTotalAddresses = VNET_INFO_GLOBAL ? VNET_INFO_GLOBAL.numAddresses : 1; // Avoid division by zero if VNET_INFO_GLOBAL is not set

        blocks.forEach(block => {
            const data = block.ipBlockData;
            if (!data) return;

            const blockActualWidth = (data.numAddresses / vnetTotalAddresses) * visualizationArea.clientWidth * currentZoom;
            
            // Clear existing text
            while (block.firstChild && block.firstChild.nodeType === Node.TEXT_NODE) {
                block.removeChild(block.firstChild);
            }

            if (blockActualWidth > 50) { // Show text if block is wider than 50px on screen
                let textContent = data.name;
                if (blockActualWidth > 100 && data.cidr) { // Show CIDR if wider
                     textContent += ` (${data.type === 'gap' ? data.cidr.split(' - ')[0] + '...' : data.cidr.split('/')[1]})`;
                }
                block.insertBefore(document.createTextNode(textContent), block.firstChild);
            }
        });
    }

    // Initial call
    updateVisualization();
});
