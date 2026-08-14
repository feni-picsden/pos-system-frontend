# POS System Dashboard

A modern, responsive Point of Sale (POS) system dashboard built with React, Material-UI, and other cutting-edge technologies.

## 🚀 Features

- **Modern UI/UX**: Clean, intuitive interface built with Material-UI
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Dynamic Dashboard**: Real-time statistics, charts, and activity tracking
- **Modular Architecture**: Well-organized component structure for scalability
- **Interactive Charts**: Beautiful visualizations using Recharts
- **Smart Navigation**: Collapsible sidebar with dynamic menu items
- **Performance Optimized**: Lazy loading, memoization, and efficient rendering
- **Accessibility Ready**: ARIA compliant and keyboard navigation support

## 📦 Tech Stack

- **React 19** - Latest React version with modern features
- **Material-UI v5** - Comprehensive React component library
- **React Router v6** - Client-side routing
- **Recharts** - Composable charting library
- **Vite** - Fast build tool and development server
- **ESLint** - Code linting and formatting

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pos-system-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://192.168.29.13:5173`

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── Layout/          # Layout components (Sidebar, Header)
│   ├── Dashboard/       # Dashboard-specific components
│   └── Charts/          # Chart components
├── pages/               # Page components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── App.jsx             # Main application component
└── main.jsx            # Application entry point
```

## 🎨 Dashboard Features

### 📊 Key Metrics Cards
- **Total Sales**: Real-time revenue tracking
- **Orders**: Order management with status indicators
- **Customers**: Customer metrics and growth tracking
- **Products**: Inventory levels and stock alerts

### 📈 Analytics & Charts
- **Sales Trend**: Interactive line chart with period filters
- **Category Distribution**: Pie chart showing sales by category
- **Real-time Updates**: Automatic data refresh every 30 seconds

### 🔄 Dynamic Components
- **Quick Actions**: Fast access to common tasks
- **Recent Activity**: Live activity feed with status indicators
- **Recent Orders**: Order management table with filtering
- **Responsive Sidebar**: Collapsible navigation with badges

### 📱 Mobile Optimization
- **Responsive Layout**: Adapts to all screen sizes
- **Touch-friendly**: Optimized for mobile interactions
- **Progressive Disclosure**: Smart content prioritization on smaller screens

## 🎯 Available Routes

- `/` - Main Dashboard
- `/sales/pos` - Point of Sale Interface
- `/sales/orders` - Order Management
- `/inventory/products` - Product Management
- `/customers` - Customer Management
- `/analytics/reports` - Analytics & Reports
- `/settings/general` - Settings Panel

## 🔧 Configuration

### Theme Customization
The app uses Material-UI's theming system. Customize colors, typography, and component styles in `src/App.jsx`:

```javascript
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  // ... other theme options
});
```

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_API_URL=http://192.168.29.13:3000/api
VITE_APP_NAME=POS System
```

## 🚀 Build for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## 🧪 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📊 Performance Features

- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Components load on demand
- **Memoization**: Optimized re-rendering with React.memo
- **Efficient State Management**: Custom hooks for data management
- **Image Optimization**: Responsive images with lazy loading

## ♿ Accessibility

- **ARIA Labels**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast**: Support for high contrast mode
- **Focus Management**: Proper focus handling
- **Reduced Motion**: Respects user motion preferences

## 🔒 Security Features

- **Input Validation**: Client-side validation for all forms
- **XSS Protection**: Sanitized user inputs
- **CSRF Protection**: Ready for CSRF token implementation
- **Secure Headers**: Production security headers

## 🌐 Browser Support

- **Chrome**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Edge**: Latest 2 versions

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

For support, email support@possystem.com or join our Slack channel.

## 🔄 Updates

Stay updated with the latest features and improvements by watching this repository.

---

**Built with ❤️ using React and Material-UI**