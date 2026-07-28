/**
 * Seguridad reutilizable de rutas: valida el token, vuelve a consultar que la
 * cuenta siga activa y luego compara su rol con los permitidos.
 */
import {
  findPublicUserById,
  verifyAccessToken
} from '../services/auth.service.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authorization.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);
    // Consultar PostgreSQL invalida al instante tokens de cuentas bloqueadas.
    const user = await findPublicUserById(payload.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }

    next(error);
  }
};

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
  }

  next();
};
