# VNet IP Address Usage Visualizer

This HTML page provides a visualization of IP address allocation within a Virtual Network (VNet). It helps in understanding how the VNet's address space is divided among its subnets and identifies any unallocated IP address ranges.

## Features

*   **VNet Overview**: Displays general information about the VNet, including its total size.
*   **Visual IP Block Representation**: Shows a graphical bar where each segment represents a subnet or an unallocated portion of the VNet.
    *   Subnets are color-coded for easy identification.
    *   Unallocated spaces are also distinctly colored.
*   **Interactive Tooltips**: Hovering over any segment in the visualization bar displays detailed information about that block, such as its name, CIDR, IP address range, and size.
*   **Zoom and Pan**: The visualization bar supports zooming in and out (using the mouse wheel) and panning (by clicking and dragging) to inspect specific areas of the VNet, especially useful for large VNets or very small subnets.
*   **Legend**: A legend is provided to map subnet names and "Unallocated" space to their respective colors in the visualization.
*   **Subnet Details Table**: Lists all configured subnets with their names, CIDR notation, IP address range, total number of IPs, and the percentage of the VNet they occupy. Also allows for direct management of subnets.
*   **Dynamic Configuration Management**:
    *   **VNet CIDR Update**: Modify the VNet CIDR directly through the UI.
    *   **Subnet Management (in-table)**:
        *   **Add a new subnet**: Click the "+ Add Subnet" button at the bottom of the "Subnet Details" table. This will reveal input fields to enter the new subnet's name and CIDR, then save or cancel.
        *   **Delete a subnet**: Click the trash can icon (🗑️) in the "Actions" column for the respective subnet in the "Subnet Details" table. A confirmation will be asked.
    *   **Local Storage Persistence**: Your VNet and subnet configurations are automatically saved in the browser's local storage, so your settings persist across sessions.
    *   **Reset to Defaults**: A "Reset to Defaults" button allows you to easily revert to the initial sample configuration.
*   **Error Handling**: The tool will display error messages for common configuration issues, such as subnets defined outside the VNet's range or overlapping subnets.
*   **Initial Default Configuration**: Comes with a pre-defined default VNet and subnet layout in the script, which is used if no configuration is found in local storage or after a reset.

## How to Use

1.  Open the `index.html` file in a web browser.
2.  The visualizer will load with a default VNet and subnet configuration, or your previously saved configuration from local storage.
3.  **To modify the VNet CIDR**:
    *   Go to the "Configuration" section.
    *   Enter the new VNet CIDR in the input field.
    *   Click the "Update VNet" button.
4.  **To manage subnets**:
    *   Navigate to the "Subnet Details" table.
    *   **Add a new subnet**:
        *   Click the "+ Add Subnet" button located at the bottom of the table.
        *   The button row will transform into input fields for "Subnet Name" and "Subnet CIDR".
        *   Enter the required details and click "Save". To discard, click "Cancel".
    *   **Delete a subnet**:
        *   Locate the subnet you wish to remove in the table.
        *   Click the trash can icon (🗑️) in the "Actions" column for that subnet.
        *   Confirm the deletion when prompted.
5.  Changes to the VNet or subnets are automatically saved to your browser's local storage and the visualization updates instantly.
6.  To revert to the original default configuration provided in the script, click the "Reset to Defaults" button in the "Configuration" section.
7.  Use the mouse wheel to zoom and click-and-drag to pan the visualization bar for a closer look.
8.  Hover over blocks in the visualization to see tooltips with more information.

This tool is intended for quick, client-side visualization and does not require any backend or external dependencies beyond a modern web browser.