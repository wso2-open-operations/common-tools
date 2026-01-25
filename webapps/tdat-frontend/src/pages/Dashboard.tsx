import React from 'react'
import Sidebar from '../components/Sidebar'

function Dashboard() {
    return (

        <div>
            <Sidebar />
            <div style={{display: 'flex', justifyContent: 'center'}}>
                Dashboard Page
            </div>
        </div>
    )
}

export default Dashboard