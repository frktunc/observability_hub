# 👥 User Service

Business mikroservisi - Kullanıcı yönetimi ve observability logging örneği.

## 🎯 Özellikler

- **Express.js** RESTful API
- **User CRUD** operations
- **@observability-hub/log-client** entegrasyonu  
- **TypeScript** strict mode
- **Production-ready** architecture

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build && npm start
```

## 📝 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/users` | List users |
| `POST` | `/users` | Create user |
| `GET` | `/users/:id` | Get user |
| `PUT` | `/users/:id` | Update user |
| `DELETE` | `/users/:id` | Delete user |

## 🔧 Usage Example

```bash
# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }'

# List users  
curl http://localhost:3000/users
```

## 🏗️ Observability

Bu servis **@observability-hub/log-client** kullanarak:

- ✅ Structured logging
- ✅ Business events  
- ✅ Error tracking
- ✅ Performance metrics
- ✅ RabbitMQ direct publishing

## 🔄 Development

```bash
npm run dev     # Development with hot reload
npm test        # Run tests
npm run lint    # Code linting
``` 