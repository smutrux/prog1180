import toast from 'react-hot-toast';

export const notifySuccess = (message: string) => {
  toast.success(message, {
    style: {
      borderRadius: '8px',
      background: '#333',
      color: '#fff',
    },
  });
};

export const notifyError = (message: string) => {
  toast.error(message, {
    style: {
      borderRadius: '8px',
      background: '#333',
      color: '#fff',
    },
  });
};