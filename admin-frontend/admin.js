let allOrders = [];
let searchTimeout; 
const { jsPDF } = window.jspdf;
let isMessageShown = false;
let hideMessageTimeout; 
document.addEventListener('DOMContentLoaded', function() {
     if (!localStorage.getItem('authToken')) { 
        window.location.href = 'login.html'; }
     }); document.getElementById('logoutButton')
     .addEventListener('click', function() { 
        localStorage.removeItem('authToken'); 
        window.location.href = 'login.html';
     });

async function fetchOrders() {
    try {
        const response = await fetch('http://localhost:5000/api/orders'); 
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        allOrders = data; 
        console.log(data);  
        filterOrders();
    } catch (error) {
        console.error('Error fetching orders:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchOrders(); 
});


// Filter orders based on status and search query
function filterOrders() {
    const statusFilterElement = document.getElementById('statusFilter');
    const searchInputElement = document.getElementById('searchInput');

    if (!statusFilterElement || !searchInputElement) {
        console.error('One or more elements are missing from the DOM');
        return;
    }

    const filterValue = statusFilterElement.value;
    const searchQuery = searchInputElement.value.toLowerCase();
    const currentTime = new Date();

    let filteredOrders = filterValue === 'all' ? allOrders : allOrders.filter(order => order.status === filterValue);

    if (searchQuery) {
        filteredOrders = filteredOrders.filter(order =>
            order.name.toLowerCase().includes(searchQuery) ||
            order.email.toLowerCase().includes(searchQuery) ||
            order.phone.includes(searchQuery) ||
            String(order.code).toLowerCase().includes(searchQuery))
    }

    // Sort orders based on the closest arrivalTime to the current time
    filteredOrders.sort((a, b) => {
        const timeA = Math.abs(new Date(a.arrivalTime) - currentTime);
        const timeB = Math.abs(new Date(b.arrivalTime) - currentTime);
        return timeA - timeB;
    });

    console.log('Filtered Orders:', filteredOrders);
    renderOrders(filteredOrders);
}



// Function to render orders
function renderOrders(orders) {
    const tableBody = document.getElementById('ordersTableBody');
    const noResultsMessage = document.getElementById('noResultsMessage');
    tableBody.innerHTML = ''; 

    if (orders.length === 0) {
        if (!isMessageShown) {
            
            if (!noResultsMessage) {
                const messageElement = document.createElement('tr');
                messageElement.id = 'noResultsMessage';
                messageElement.innerHTML = `<td colspan="9" style="text-align: center; color: #f44336; font-weight: bold;">Try different keywords</td>`;
                tableBody.appendChild(messageElement);
            }
            isMessageShown = true;

            if (hideMessageTimeout) {
                clearTimeout(hideMessageTimeout); 
            }
            hideMessageTimeout = setTimeout(() => {
                hideMessage();
            }, 3000); 
        }
    } else {
        if (noResultsMessage) {
            noResultsMessage.remove();
        }
        isMessageShown = false; 
    }

    // Render orders
    orders.forEach((order, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${order.code}</td>
            <td class="name">${order.name}</td>
            <td>${order.email}</td>
            <td class="phone">${order.phone}</td>
            <td class="date">${new Date(order.arrivalTime).toLocaleString()}</td>
            <td class="items">${renderItems(order.items)}</td>
            <td>₹${order.totalPrice.toFixed(2)}</td>
            <td class="date">${new Date(order.createdAt).toLocaleString()}</td>
            <td id="action-${order._id}">
                <div class="button-container">
                    ${renderActionButtons(order)}
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}
fetchOrders();
// Function to render items
function renderItems(items) {
    return items.map(item => `${item.name} (x${item.quantity})`).join(', ');
}

// Function to render action buttons
function renderActionButtons(order) {
    if (order.status === 'pending') {
        return ` 
            <button class="button served" onclick="updateOrderStatus('${order._id}', 'served')">Order Served</button>
            <button class="button canceled" onclick="updateOrderStatus('${order._id}', 'canceled')">Order Canceled</button>
        `;
    } else {
        return ` 
            ${order.status === 'served' ? 'Order Served' : 'Order Canceled'}
            <button class="button reset" onclick="resetOrderStatus('${order._id}')">Undo</button>
        `;
    }
}

// Function to update the status of an order
async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
            throw new Error('Failed to update order status');
        }

        const result = await response.json();
        const updatedOrder = result.order;  

        if (!updatedOrder || !updatedOrder._id) {
            console.error('Updated order does not have an _id:', updatedOrder);
            alert('Error: Order update failed.');
            return;
        }
        const orderRow = document.getElementById(`action-${updatedOrder._id}`);
        if (orderRow) {
            orderRow.innerHTML = renderActionButtons(updatedOrder); 
        } else {
            console.error(`Order row with ID 'action-${updatedOrder._id}' not found`);
                fetchOrders();
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert(error.message); 
    }
}

// Function to reset the status of an order (Undo action)
async function resetOrderStatus(orderId) {
    try {
        const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'pending' }),
        });

        if (!response.ok) {
            throw new Error('Failed to reset order status');
        }

        const result = await response.json();
        const updatedOrder = result.order;  
        if (!updatedOrder || !updatedOrder._id) {
            console.error('Updated order does not have an _id:', updatedOrder);
            alert('Error: Order update failed.');
            return;
        }
        const orderRow = document.getElementById(`action-${updatedOrder._id}`);
        if (orderRow) {
            orderRow.innerHTML = renderActionButtons(updatedOrder);
        } else {
            console.error(`Order row with ID 'action-${updatedOrder._id}' not found`);
            fetchOrders(); 
        }
    } catch (error) {
        console.error('Error resetting order status:', error);
        alert(error.message); 
    }
}
// Function to check if the order was created today
function isOrderToday(order) {
    const today = new Date();
    const orderDate = new Date(order.createdAt);
    return today.toDateString() === orderDate.toDateString();
}


// Function to show the popup with selected date or month summary
function showPopup() {
    const selectedDate = document.getElementById('datePicker').value;
    const selectedMonth = document.getElementById('monthPicker').value;

    let selectedDateText = "Today";  
    let filteredOrders;

    if (selectedDate) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate.toLocaleDateString() === new Date(selectedDate).toLocaleDateString();
        });
        const orderDate = new Date(selectedDate);
        selectedDateText = orderDate.toLocaleDateString();
    } else if (selectedMonth) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate.getFullYear() === parseInt(selectedMonth.split("-")[0]) &&
                   orderDate.getMonth() === parseInt(selectedMonth.split("-")[1]) - 1;
        });
        const monthDate = new Date(selectedMonth + "-01");
        selectedDateText = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else {
        filteredOrders = allOrders.filter(order => isOrderToday(order));
        const today = new Date();
        selectedDateText = today.toLocaleDateString();
    }

    document.getElementById('selectedDate').textContent = selectedDateText;
    const totalOrders = filteredOrders.length;
    const servedOrders = filteredOrders.filter(order => order.status === 'served').length;
    const canceledOrders = filteredOrders.filter(order => order.status === 'canceled').length;

    // Calculate total earnings for only served orders
    const totalEarnings = filteredOrders
        .filter(order => order.status === 'served')
        .reduce((total, order) => total + order.totalPrice, 0);
    
    const servedItems = filteredOrders
        .filter(order => order.status === 'served')
        .reduce((items, order) => {
            order.items.forEach(item => {
                const existingItem = items.find(i => i.name === item.name);
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                } else {
                    items.push({ ...item });
                }
            });
            return items;
        }, []);

    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('servedOrders').textContent = servedOrders;
    document.getElementById('canceledOrders').textContent = canceledOrders;
    document.getElementById('totalEarnings').textContent = totalEarnings.toFixed(2);

    const servedItemsList = document.getElementById('servedItemsList');
    servedItemsList.innerHTML = '';
    servedItems.forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} (x${item.quantity})`;
        servedItemsList.appendChild(li);
    });

    document.getElementById('overlay').style.display = 'block';
    document.getElementById('popup').style.display = 'block';
}


function hidePopup() {
    console.log('Hiding popup'); 
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('popup').style.display = 'none';
}


function generatePDFReport() {
    const selectedDate = document.getElementById('datePicker').value;
    const selectedMonth = document.getElementById('monthPicker').value;

    let filteredOrders;

    if (selectedDate) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate.toLocaleDateString() === new Date(selectedDate).toLocaleDateString();
        });
    } else if (selectedMonth) {
        filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return orderDate.getFullYear() === parseInt(selectedMonth.split("-")[0]) &&
                   orderDate.getMonth() === parseInt(selectedMonth.split("-")[1]) - 1;
        });
    } else {
        filteredOrders = allOrders.filter(order => isOrderToday(order));
    }

    const totalOrders = filteredOrders.length;
    const servedOrders = filteredOrders.filter(order => order.status === 'served').length;
    const canceledOrders = filteredOrders.filter(order => order.status === 'canceled').length;
    const totalEarnings = filteredOrders
        .filter(order => order.status === 'served')
        .reduce((total, order) => total + order.totalPrice, 0);

    // Aggregate served items
    const servedItems = filteredOrders
        .filter(order => order.status === 'served')
        .reduce((items, order) => {
            order.items.forEach(item => {
                const existingItem = items.find(i => i.name === item.name);
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                } else {
                    items.push({ ...item });
                }
            });
            return items;
        }, []);

    const doc = new jsPDF();
    doc.addFont('path-to-font/FreeSerif.ttf', 'FreeSerif', 'normal'); 
    doc.setFont('FreeSerif');

    doc.setFontSize(18);
    doc.text('Order Summary Report', 20, 20);

    let selectedDateText;  
    if (selectedDate) {
        const orderDate = new Date(selectedDate);
        selectedDateText = orderDate.toLocaleDateString();
    } else if (selectedMonth) {
        const monthDate = new Date(selectedMonth + "-01");
        selectedDateText = monthDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else {
        const today = new Date();
        selectedDateText = today.toLocaleDateString(); 
    }
    

    doc.setFontSize(14);
    doc.text(`Selected Date: ${selectedDateText}`, 20, 30);

    doc.setFontSize(12);
    doc.text(`Total Orders: ${totalOrders}`, 20, 40);
    doc.text(`Orders Served: ${servedOrders}`, 20, 50);
    doc.text(`Orders Canceled: ${canceledOrders}`, 20, 60);
    doc.text(`Total Earnings: ${totalEarnings.toFixed(2)}`, 20, 70);

    doc.text('Served Items:', 20, 80);
    let yOffset = 90;
    servedItems.forEach((item, index) => {
        doc.text(`${index + 1}. ${item.name} (x${item.quantity})`, 20, yOffset);
        yOffset += 10;
    });

    doc.save('order_summary.pdf');
}

function hideMessage() {
    const noResultsMessage = document.getElementById('noResultsMessage');
    if (noResultsMessage) {
        noResultsMessage.remove();
    }
    isMessageShown = false;
}

// Add debounce to the search input
document.getElementById('searchInput').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
        filterOrders(); 
    }, 500); 
});

function exportOrdersToPDF() {
    const doc = new jsPDF();
    const orders = allOrders;

    console.log('All Orders:', orders);

    if (orders.length === 0) {
        alert("No orders available to export.");
        return;
    }

    const groupedOrders = groupOrdersByStatus(orders);
    console.log('Grouped Orders by Status:', groupedOrders);

    doc.setFontSize(18);
    doc.text("Order Report", 20, 20);

    let yPosition = 30;
    const lineMargin = 5;

    const pageHeight = doc.internal.pageSize.height; 
    const maxY = pageHeight - 30; 

    doc.addFont('path-to-font/Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
    

    // Loop through each status group (e.g., "Pending", "Served", "Canceled")
    for (let status in groupedOrders) {
        const statusOrders = groupedOrders[status];

        console.log(`Orders in ${status} group:`, statusOrders);

        if (yPosition > maxY) {
            doc.addPage(); 
            yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text(`${status.charAt(0).toUpperCase() + status.slice(1)} Orders`, 20, yPosition);
        yPosition += lineMargin + 10; 
        const groupedByDate = groupOrdersByDate(statusOrders);

        console.log(`Grouped by Date for ${status}:`, groupedByDate);

        for (let date in groupedByDate) {
            const dateOrders = groupedByDate[date];

            console.log(`Orders on ${date}:`, dateOrders);

            if (yPosition > maxY) {
                doc.addPage(); 
                yPosition = 20; 
            }

            doc.setFontSize(12);
            doc.text(`Date: ${date}`, 20, yPosition);
            yPosition += lineMargin + 5; 
            dateOrders.forEach((order, index) => {
                if (yPosition > maxY) {
                    doc.addPage(); 
                    yPosition = 20; 
                }

                doc.setFontSize(10);
                doc.text(`Order #${index + 1}`, 20, yPosition);
                doc.text(`Name: ${order.name}`, 20, yPosition + 6);
                doc.text(`Email: ${order.email}`, 20, yPosition + 12);
                doc.text(`Phone: ${order.phone}`, 20, yPosition + 18);
                doc.text(`Total Price: ${order.totalPrice.toFixed(2)}`, 20, yPosition + 24); 
                doc.text(`Arrival Time: ${new Date(order.arrivalTime).toLocaleString()}`, 20, yPosition + 30);
                
                yPosition += 40; 
                doc.text("--------------------------------------------------------", 20, yPosition); 
                yPosition += 5; 
            });

            yPosition += 10; 
        }
    }

    // Save the PDF
    doc.save("orders_report.pdf");
}

// Function to group orders by status
function groupOrdersByStatus(orders) {
    return orders.reduce((grouped, order) => {
        if (!grouped[order.status]) {
            grouped[order.status] = [];
        }
        grouped[order.status].push(order);
        return grouped;
    }, {});
}

// Function to group orders by date
function groupOrdersByDate(orders) {
    return orders.reduce((grouped, order) => {
        const date = new Date(order.createdAt).toLocaleDateString();
        if (!grouped[date]) {
            grouped[date] = [];
        }
        grouped[date].push(order);
        return grouped;
    }, {});
}



// Periodically refresh data
setInterval(() => {
    fetchOrders();
}, 3000); 

fetchOrders();
