async function getForecast(salesData, alpha, periods = 1) {
    const response = await fetch('http://localhost:5001/forecast', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sales_data: salesData,
            alpha: alpha,
            periods: periods
        })
    });
    
    if (!response.ok) {
        throw new Error('Forecast API failed');
    }
    
    return await response.json();
}
