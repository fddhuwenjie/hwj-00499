import { getUserById, updateUser } from '../api/user';

export function useUser(userId) {
  const user = ref(null);
  const loading = ref(false);

  async function loadUser() {
    loading.value = true;
    try {
      const data = await getUserById(userId);
      user.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function saveUser(userData) {
    const result = await updateUser(userId, userData);
    user.value = result;
    return result;
  }

  return {
    user,
    loading,
    loadUser,
    saveUser
  };
}
